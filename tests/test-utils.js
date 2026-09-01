import { readFileSync } from 'fs';
import { resolve } from 'path';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { STATE } from '../public/js/state.js';
import { initApp, resetAppInitialized } from '../public/js/main.js';
import { DEFAULT_QUESTIONS, seedDefaults, createCustomQuestion } from '../public/js/questions.js';
import { startNewCheckIn, finalizeCheckin, renderCurrentQuestion, buildScoreButtonsHTML } from '../public/js/checkin.js';
import { renderLineGraph, loadHistoryView, computeGraphLayout, renderGraphSVG } from '../public/js/ui/history-graph.js';
import { navigateTo, setCurrentViewId } from '../public/js/ui/navigation.js';
import { getAll, put, getConfig, setConfig, deleteConfig } from '../public/js/storage/db.js';
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
    windowInstance.matchMedia = windowInstance.matchMedia || function() {
        return {
            matches: false,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {}
        };
    };

    // Polyfill requestAnimationFrame
    windowInstance.requestAnimationFrame = windowInstance.requestAnimationFrame || function(callback) {
        return setTimeout(callback, 0);
    };
    windowInstance.cancelAnimationFrame = windowInstance.cancelAnimationFrame || function(identifier) {
        clearTimeout(identifier);
    };

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
    windowInstance['STATE'] = STATE;
    windowInstance.startNewCheckIn = startNewCheckIn;
    windowInstance.renderLineGraph = renderLineGraph;
    windowInstance.computeGraphLayout = computeGraphLayout;
    windowInstance.renderGraphSVG = renderGraphSVG;
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
    windowInstance.DEFAULT_QUESTIONS = DEFAULT_QUESTIONS;
    windowInstance.seedDefaults = seedDefaults;
    windowInstance.put = put;
    windowInstance.getAll = getAll;
    windowInstance.getConfig = getConfig;
    windowInstance.setConfig = setConfig;
    windowInstance.deleteConfig = deleteConfig;
    windowInstance.applyStoredDisplay = applyStoredDisplay;

    resetAppInitialized();
    await initApp();

    // Wait deterministically for async initDatabase promise chain and initial render to complete
    await waitFor(() => Boolean(
        windowInstance.STATE &&
        windowInstance.STATE.activeQuestions &&
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
