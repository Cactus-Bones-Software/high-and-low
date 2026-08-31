// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { setupTestDOM, sleep, createSampleCheckIn } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

async function initializeTestEnvironment(customSessionStorage = {}) {
    const environment = await setupTestDOM(customSessionStorage);
    domInstance = environment.dom;
    windowInstance = environment.window;
    documentInstance = environment.document;
}

describe('Check-in and View State Persistence (Theme Switch & Reload Resilience)', () => {
    it('restores in-progress question index and note on reload', async () => {
        const savedCheckin = createSampleCheckIn();

        await initializeTestEnvironment({
            'high_and_low_active_checkin': JSON.stringify(savedCheckin)
        });

        const progressText = documentInstance.getElementById('progress-text');
        expect(progressText.textContent).toContain('Question 3 of');

        const noteButtonLabel = documentInstance.getElementById('button-notes').querySelector('.button-label');
        expect(noteButtonLabel.textContent).toBe('Note Attached ✓');

        expect(windowInstance.STATE.currentQuestionIndex).toBe(2);
        expect(windowInstance.STATE.checkinAnswers.length).toBe(2);
        expect(windowInstance.STATE.checkinNote).toBe('Feeling decent this afternoon.');
    });

    it('restores currently active view on reload', async () => {
        await initializeTestEnvironment({
            'high_and_low_active_view': 'settings-canvas'
        });

        const settingsCanvas = documentInstance.getElementById('settings-canvas');
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');

        expect(settingsCanvas.classList.contains('view-active')).toBe(true);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
    });

    it('saves answers to sessionStorage when answering a question', async () => {
        await initializeTestEnvironment();

        const firstScoreButton = documentInstance.querySelector('.score-button');
        firstScoreButton.click();

        // Allow microtask and transition
        await sleep(250);

        const stored = windowInstance.sessionStorage.getItem('high_and_low_active_checkin');
        expect(stored).not.toBeNull();

        const parsed = JSON.parse(stored);
        expect(parsed.currentQuestionIndex).toBe(1);
        expect(parsed.checkinAnswers.length).toBe(1);
    });

    it('persists view in sessionStorage when navigateTo is called', async () => {
        await initializeTestEnvironment();

        windowInstance.navigateTo('history-canvas');

        expect(windowInstance.sessionStorage.getItem('high_and_low_active_view')).toBe('history-canvas');
    });

    it('clears active check-in in sessionStorage when check-in is finalized', async () => {
        await initializeTestEnvironment();

        windowInstance.finalizeCheckin();
        await sleep(50);

        expect(windowInstance.sessionStorage.getItem('high_and_low_active_checkin')).toBeNull();
    });

    it('clears active check-in in sessionStorage when startNewCheckIn is called', async () => {
        await initializeTestEnvironment({
            'high_and_low_active_checkin': JSON.stringify({
                currentQuestionIndex: 1,
                checkinAnswers: [{ questionId: 'q_energy', score: 3, status: 'answered' }],
                checkinNote: null,
                updatedAt: Date.now()
            })
        });

        await windowInstance.startNewCheckIn();

        expect(windowInstance.sessionStorage.getItem('high_and_low_active_checkin')).toBeNull();
        expect(windowInstance.STATE.currentQuestionIndex).toBe(0);
    });

    it('discards stale check-in if older than 30 minutes (30m TTL expiry)', async () => {
        const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
        await initializeTestEnvironment({
            'high_and_low_active_checkin': JSON.stringify(createSampleCheckIn({
                checkinNote: 'Old stale note',
                updatedAt: thirtyOneMinutesAgo
            }))
        });

        // Should have reset to Question 1 because the check-in timed out
        const progressText = documentInstance.getElementById('progress-text');
        expect(progressText.textContent).toContain('Question 1 of');
        expect(windowInstance.STATE.currentQuestionIndex).toBe(0);
        expect(windowInstance.STATE.checkinAnswers.length).toBe(0);
        expect(windowInstance.STATE.checkinNote).toBeNull();
        expect(windowInstance.sessionStorage.getItem('high_and_low_active_checkin')).toBeNull();
    });

    it('logs console warnings without crashing when sessionStorage operations fail', async () => {
        await initializeTestEnvironment();

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Mock Storage.prototype.setItem to throw (e.g. quota exceeded or security restriction)
        const setItemSpy = vi.spyOn(windowInstance.Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError');
        });

        // Test saveActiveCheckin handles error gracefully
        expect(() => windowInstance.saveActiveCheckin()).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to save active check-in state to sessionStorage:',
            expect.any(Error)
        );

        // Test saveActiveView handles error gracefully
        warnSpy.mockClear();
        expect(() => windowInstance.saveActiveView('settings-canvas')).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to save active view state to sessionStorage:',
            expect.any(Error)
        );

        setItemSpy.mockRestore();

        // Mock Storage.prototype.getItem to throw
        const getItemSpy = vi.spyOn(windowInstance.Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });

        warnSpy.mockClear();
        expect(() => windowInstance.restoreActiveCheckin()).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to restore active check-in state from sessionStorage:',
            expect.any(Error)
        );

        warnSpy.mockClear();
        expect(windowInstance.getStoredActiveView()).toBeNull();
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to retrieve active view state from sessionStorage:',
            expect.any(Error)
        );

        getItemSpy.mockRestore();
        warnSpy.mockRestore();
    });
});
