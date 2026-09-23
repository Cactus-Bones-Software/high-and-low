import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { STATE } from '../public/js/state.js';
import { initApp, resetAppInitialized, registerServiceWorker } from '../public/js/main.js';
import {
    DEFAULT_QUESTIONS,
    ALLOWED_RESPONSE_TYPES,
    BOOLEAN_NO_SCORE,
    BOOLEAN_YES_SCORE,
    seedDefaults,
    createCustomQuestion,
    updateCustomQuestion,
    archiveQuestion,
    restoreQuestion,
    removeQuestion,
    removeCustomQuestion,
    moveActiveQuestion,
    removeQuestionFromTracker,
    addQuestionToTracker
} from '../public/js/questions.js';
import {
    loadQuestionsView,
    buildActiveQuestionCardHTML,
    archiveQuestionFromAuthoring,
    removeQuestionFromAuthoring,
    saveQuestionFromAuthoring,
    cancelQuestionAuthoring
} from '../public/js/ui/question-view.js';
import { startNewCheckIn, finalizeCheckin, renderCurrentQuestion, buildScoreButtonsHTML } from '../public/js/checkin.js';
import {
    renderLineGraph,
    loadHistoryView,
    computeGraphLayout,
    renderGraphSVG,
    BASE_PIXELS_PER_HOUR,
    calculateTimeframePresetZoomScale,
    calculateZoomPivotScrollLeft,
    calculateNowScrollLeft
} from '../public/js/ui/history-graph.js';
import { navigateTo, setCurrentViewId } from '../public/js/ui/navigation.js';
import { get, getAll, put, getConfig, setConfig, deleteConfig } from '../public/js/storage/db.js';
import { saveActiveCheckin, clearActiveCheckin, restoreActiveCheckin, saveActiveView, getStoredActiveView } from '../public/js/storage/session.js';
import { applyStoredDisplay } from '../public/js/ui/settings-menu.js';
import { escapeHTML, html, rawHTML } from '../public/js/utils.js';

const htmlContent = readFileSync(resolve(__dirname, '../public/index.html'), 'utf8');

/**
 * Checks whether an element is marked as inert either via attribute or property.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isElementInert(element) {
    return element.hasAttribute('inert') || element.inert === true;
}

/**
 * Async sleep utility for test waiting.
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
export function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/**
 * Polls until a predicate returns true or timeout expires.
 * @param {() => boolean | Promise<boolean>} predicate
 * @param {number} timeoutMilliseconds
 * @param {number} intervalMilliseconds
 * @returns {Promise<void>}
 */
export async function waitFor(predicate, timeoutMilliseconds = 1500, intervalMilliseconds = 20) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMilliseconds) {
        if (await predicate()) return;
        await sleep(intervalMilliseconds);
    }
}

/**
 * Initializes a clean JSDOM instance with IndexedDB, Storage, and Polyfills.
 * @param {Record<string, string>} [customSessionStorage={}]
 * @returns {Promise<{ dom: JSDOM, window: Window, document: Document }>}
 */
export async function setupTestDOM(customSessionStorage = {}) {
    const domInstance = new JSDOM(htmlContent, {
        url: 'http://localhost:3000',
        runScripts: 'dangerously'
    });
    const windowInstance = domInstance.window;
    const documentInstance = windowInstance.document;

    // Fresh isolated fake indexedDB per test instance
    windowInstance.indexedDB = new IDBFactory();
    windowInstance.IDBKeyRange = IDBKeyRange;

    // Seed custom sessionStorage if specified
    for (const [storageKey, storageValue] of Object.entries(customSessionStorage)) {
        windowInstance.sessionStorage.setItem(storageKey, storageValue);
    }

    // Polyfill matchMedia on window in JSDOM
    windowInstance.matchMedia = windowInstance.matchMedia || ((query) => ({
        matches: false,
        media: query
    }));

    // Polyfill requestAnimationFrame
    windowInstance.requestAnimationFrame = windowInstance.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
    windowInstance.cancelAnimationFrame = windowInstance.cancelAnimationFrame || ((identifier) => {
        clearTimeout(identifier);
    });

    // Polyfill navigator.serviceWorker
    if (!windowInstance.navigator.serviceWorker) {
        Object.defineProperty(windowInstance.navigator, 'serviceWorker', {
            value: { register: async () => {} },
            writable: true,
            configurable: true
        });
    }

    // Bind globals safely so imported modules execute against this active window/document instance
    global.window = windowInstance;
    global.document = documentInstance;
    global.sessionStorage = windowInstance.sessionStorage;
    global.localStorage = windowInstance.localStorage;
    global.indexedDB = windowInstance.indexedDB;
    global.IDBKeyRange = windowInstance.IDBKeyRange;
    global.history = windowInstance.history;
    global.PointerEvent = windowInstance.PointerEvent;
    global.MouseEvent = windowInstance.MouseEvent;
    global.Event = windowInstance.Event;
    global.CustomEvent = windowInstance.CustomEvent;

    // Reset singleton in-memory state
    STATE.activeQuestions = [];
    STATE.currentQuestionIndex = 0;
    STATE.checkinAnswers = [];
    STATE.checkinNote = null;
    STATE.deviceMode = 'mouse';
    STATE.historyVisibleQuestionIds = null;
    STATE.historyTimeRange = 'all';
    STATE.historyZoomScale = 1;
    STATE.historyScrollLeft = 0;
    setCurrentViewId('tracker-canvas');

    // Expose helpers directly on windowInstance
    windowInstance.STATE = STATE;
    windowInstance.startNewCheckIn = startNewCheckIn;
    windowInstance.renderLineGraph = renderLineGraph;
    windowInstance.computeGraphLayout = computeGraphLayout;
    windowInstance.renderGraphSVG = renderGraphSVG;
    windowInstance.BASE_PIXELS_PER_HOUR = BASE_PIXELS_PER_HOUR;
    windowInstance.calculateTimeframePresetZoomScale = calculateTimeframePresetZoomScale;
    windowInstance.calculateZoomPivotScrollLeft = calculateZoomPivotScrollLeft;
    windowInstance.calculateNowScrollLeft = calculateNowScrollLeft;
    windowInstance.loadHistoryView = loadHistoryView;
    windowInstance.navigateTo = navigateTo;
    windowInstance.finalizeCheckin = finalizeCheckin;
    windowInstance.renderCurrentQuestion = renderCurrentQuestion;
    windowInstance.buildScoreButtonsHTML = buildScoreButtonsHTML;
    windowInstance.saveActiveCheckin = saveActiveCheckin;
    windowInstance.clearActiveCheckin = clearActiveCheckin;
    windowInstance.restoreActiveCheckin = restoreActiveCheckin;
    windowInstance.saveActiveView = saveActiveView;
    windowInstance.getStoredActiveView = getStoredActiveView;
    windowInstance.escapeHTML = escapeHTML;
    windowInstance.html = html;
    windowInstance.rawHTML = rawHTML;
    windowInstance.createCustomQuestion = createCustomQuestion;
    windowInstance.updateCustomQuestion = updateCustomQuestion;
    windowInstance.archiveQuestion = archiveQuestion;
    windowInstance.restoreQuestion = restoreQuestion;
    windowInstance.removeQuestion = removeQuestion;
    windowInstance.removeCustomQuestion = removeCustomQuestion;
    windowInstance.archiveQuestionFromAuthoring = archiveQuestionFromAuthoring;
    windowInstance.removeQuestionFromAuthoring = removeQuestionFromAuthoring;
    windowInstance.saveQuestionFromAuthoring = saveQuestionFromAuthoring;
    windowInstance.cancelQuestionAuthoring = cancelQuestionAuthoring;
    windowInstance.moveActiveQuestion = moveActiveQuestion;
    windowInstance.removeQuestionFromTracker = removeQuestionFromTracker;
    windowInstance.addQuestionToTracker = addQuestionToTracker;
    windowInstance.loadQuestionsView = loadQuestionsView;
    windowInstance.buildActiveQuestionCardHTML = buildActiveQuestionCardHTML;
    windowInstance.DEFAULT_QUESTIONS = DEFAULT_QUESTIONS;
    windowInstance.ALLOWED_RESPONSE_TYPES = ALLOWED_RESPONSE_TYPES;
    windowInstance.BOOLEAN_NO_SCORE = BOOLEAN_NO_SCORE;
    windowInstance.BOOLEAN_YES_SCORE = BOOLEAN_YES_SCORE;
    windowInstance.seedDefaults = seedDefaults;
    windowInstance.put = put;
    windowInstance.get = get;
    windowInstance.getAll = getAll;
    windowInstance.getConfig = getConfig;
    windowInstance.setConfig = setConfig;
    windowInstance.deleteConfig = deleteConfig;
    windowInstance.applyStoredDisplay = applyStoredDisplay;
    windowInstance.registerServiceWorker = registerServiceWorker;

    resetAppInitialized();
    await initApp();

    // Wait deterministically for async initDatabase promise chain and initial render to complete
    await waitFor(() => Boolean(
        windowInstance.STATE?.activeQuestions &&
        windowInstance.STATE.activeQuestions.length > 0 &&
        documentInstance.getElementById('progress-text') &&
        documentInstance.getElementById('progress-text').textContent !== 'Loading tracker...'
    ));

    return {
        dom: domInstance,
        window: windowInstance,
        document: documentInstance
    };
}

/**
 * Creates a standard sample check-in object for sessionStorage persistence testing.
 * @param {Record<string, unknown>} [overrides={}]
 * @returns {Record<string, unknown>}
 */
export function createSampleCheckIn(overrides = {}) {
    return {
        currentQuestionIndex: 2,
        checkinAnswers: [
            { questionId: 'q_energy', score: 4, status: 'answered' },
            { questionId: 'q_sadness', score: 1, status: 'answered' }
        ],
        checkinNote: 'Feeling decent this afternoon.',
        updatedAt: Date.now(),
        ...overrides
    };
}

/**
 * Creates a standard 3-question array for graph interaction testing.
 * @returns {Array<Record<string, unknown>>}
 */
export function createSampleGraphQuestions() {
    return [
        { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
        { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
        { id: 'q3', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' }
    ];
}

/**
 * Creates standard 2-day logs array for graph interaction testing.
 * @returns {Array<Record<string, unknown>>}
 */
export function createSampleTwoDayLogs() {
    return [
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
}

/**
 * Creates and dispatches a contextmenu event on a target element.
 * @param {Window} windowInstance
 * @param {HTMLElement} targetElement
 * @returns {MouseEvent}
 */
export function dispatchContextMenuEvent(windowInstance, targetElement) {
    const contextMenuEvent = new windowInstance.MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true
    });
    targetElement.dispatchEvent(contextMenuEvent);
    return contextMenuEvent;
}

/**
 * Creates a single question array for zoom and timeline tests.
 * @param {Record<string, unknown>} [overrides={}]
 * @returns {Array<Record<string, unknown>>}
 */
export function createSingleSampleQuestion(overrides = {}) {
    return [
        { id: 'q1', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better', ...overrides }
    ];
}

/**
 * Creates a 2-entry array spanning 1 day for zoom tests.
 * @param {number} [now=Date.now()]
 * @returns {Array<Record<string, unknown>>}
 */
export function createSampleOneDayRecentEntries(now = Date.now()) {
    return [
        { timestamp: new Date(now - 86400000).toISOString(), answers: [{ questionId: 'q1', score: 3 }] },
        { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 4 }] }
    ];
}

/**
 * Creates a 2-entry array spanning 14 days for timeline scale tests.
 * @param {number} [now=Date.now()]
 * @returns {Array<Record<string, unknown>>}
 */
export function createSampleFourteenDayEntries(now = Date.now()) {
    return [
        { timestamp: new Date(now - 14 * 86400000).toISOString(), answers: [{ questionId: 'q1', score: 2 }] },
        { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 5 }] }
    ];
}

/**
 * Configures mock clientWidth and scrollWidth on a scroll container element.
 * @param {HTMLElement} scrollContainer
 * @param {number} [clientWidth=600]
 * @param {number} [scrollWidth=3200]
 * @returns {HTMLElement}
 */
export function mockScrollDimensions(scrollContainer, clientWidth = 600, scrollWidth = 3200) {
    Object.defineProperty(scrollContainer, 'clientWidth', { value: clientWidth, configurable: true });
    Object.defineProperty(scrollContainer, 'scrollWidth', { value: scrollWidth, configurable: true });
    return scrollContainer;
}

/**
 * Navigates to the questions view and waits for list rendering to complete.
 * @param {Window} windowInstance
 * @param {Document} documentInstance
 * @returns {Promise<void>}
 */
export async function navigateToQuestionsCanvas(windowInstance, documentInstance) {
    windowInstance.navigateTo('questions-canvas', { instant: true });
    await waitFor(() => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const catalogList = documentInstance.getElementById('questions-catalog-list');
        return Boolean(
            (activeList && activeList.children.length > 0) ||
            (catalogList && catalogList.children.length > 0)
        );
    });
}

/**
 * Opens the question authoring dialog for a given card by action ('edit' or 'copy')
 * and waits for the overlay to become open.
 * @param {Document} documentInstance
 * @param {string} questionId
 * @param {'edit' | 'copy'} [action='edit']
 * @returns {Promise<HTMLElement>}
 */
export async function openQuestionAuthoringDialog(documentInstance, questionId, action = 'edit') {
    const card = documentInstance.querySelector(`[data-question-id="${questionId}"]`);
    if (!card) {
        throw new Error(`Question card with id "${questionId}" not found in DOM.`);
    }
    const buttonSelector = action === 'copy' ? '.question-copy-button' : '.question-edit-button';
    const actionButton = card.querySelector(buttonSelector);
    if (!actionButton) {
        throw new Error(`Button "${buttonSelector}" not found on card "${questionId}".`);
    }
    actionButton.click();
    const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
    await waitFor(() => Boolean(overlay?.classList?.contains('is-open')));
    return overlay;
}

/**
 * Creates a sample boolean question object for testing.
 * @param {Record<string, unknown>} [overrides={}]
 * @returns {Record<string, unknown>}
 */
export function createSampleBooleanQuestion(overrides = {}) {
    return {
        id: 'bool_q',
        text: 'Have you eaten today?',
        shortLabel: 'Eaten',
        curve: 'more-is-better',
        responseType: 'boolean',
        ...overrides
    };
}

/**
 * Creates a sample scale question object for testing.
 * @param {Record<string, unknown>} [overrides={}]
 * @returns {Record<string, unknown>}
 */
export function createSampleScaleQuestion(overrides = {}) {
    return {
        id: 'scale_q',
        text: 'Mood level',
        shortLabel: 'Mood',
        curve: 'more-is-better',
        responseType: 'scale',
        ...overrides
    };
}

/**
 * Creates an array of entries with boolean scores for graph rendering tests.
 * @param {number[]} [scores=[5, 1]]
 * @param {string} [questionId='bool_q']
 * @returns {Array<Record<string, unknown>>}
 */
export function createSampleBooleanEntries(scores = [5, 1], questionId = 'bool_q') {
    return scores.map((score, index) => ({
        timestamp: `2026-08-1${index}T10:00:00.000Z`,
        answers: [{ questionId, score, status: 'answered' }]
    }));
}

/**
 * Computes graph layout and renders SVG markup into a container div.
 * @param {Window} windowInstance
 * @param {Document} documentInstance
 * @param {Record<string, unknown>} options
 * @returns {{ layout: Record<string, unknown>, svgMarkup: string, container: HTMLElement }}
 */
export function renderGraphToContainer(windowInstance, documentInstance, options) {
    const layout = windowInstance.computeGraphLayout({
        containerWidth: 600,
        timeRange: 'all',
        zoomScale: 1,
        ...options
    });
    const svgMarkup = windowInstance.renderGraphSVG(layout);
    const container = documentInstance.createElement('div');
    container.innerHTML = svgMarkup;
    return { layout, svgMarkup, container };
}

/**
 * Helper to create and immediately remove a custom question for removed question tests.
 * @param {Window} windowInstance
 * @param {Record<string, unknown>} [options={}]
 * @returns {Promise<{ id: string, outcome: any }>}
 */
export async function createAndRemoveCustomQuestion(windowInstance, options = {}) {
    const outcome = await windowInstance.createCustomQuestion({
        text: 'Sample custom question for removal',
        shortLabel: 'Sample',
        tags: ['General'],
        curve: 'more-is-better',
        addToSet: false,
        ...options
    });
    await windowInstance.removeQuestion(outcome.id);
    return { id: outcome.id, outcome };
}

export const createAndArchiveCustomQuestion = createAndRemoveCustomQuestion;

