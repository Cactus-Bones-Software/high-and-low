/**
 * HIGH & LOW - CORE CONFIGURATION STATE
 * Single in-memory state singleton shared across modules.
 */

export const STATE = {
    language: 'en',
    activeQuestions: [],
    currentQuestionIndex: 0,
    checkinAnswers: [],
    checkinNote: null,
    deviceMode: 'mouse',
    historyActiveZoomPreset: 'all',
    get historyTimeRange() {
        return this.historyActiveZoomPreset;
    },
    set historyTimeRange(value) {
        this.historyActiveZoomPreset = value;
    },
    historyZoomScale: 1,
    historyScrollLeft: 0
};
