/**
 * HIGH & LOW - CORE CONFIGURATION STATE
 * Single in-memory state singleton shared across modules.
 */

export let STATE = {
    activeQuestions: [],
    currentQuestionIndex: 0,
    checkinAnswers: [],
    checkinNote: null,
    deviceMode: 'mouse',
    historyVisibleQuestionIds: null,
    historyTimeRange: 'all',
    historyZoomScale: 1,
    historyScrollLeft: 0
};
