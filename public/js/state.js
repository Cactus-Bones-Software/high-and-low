/**
 * HIGH & LOW - CORE CONFIGURATION STATE
 * Single in-memory state singleton shared across modules.
 */

// biome-ignore lint/style/useConst: Variable may not be reassigned, but is modified.
export  let STATE = {
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
