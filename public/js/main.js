/**
 * HIGH & LOW - MAIN APPLICATION ENTRY POINT
 * Bootstrap sequence, module wiring, database seeding, and runtime initialization.
 */

// Grab the STATE object.
import { STATE } from './state.js';
// Prepare to grab data from storage
import { initDatabase, put, getAll, getConfig, setConfig, deleteConfig } from './storage/db.js';
// Prepare to grab session details if not stale
import { restoreActiveCheckin, getStoredActiveView } from './storage/session.js';
// Prepare to load questions from storage and make new ones if necessary
import { DEFAULT_QUESTIONS, seedDefaults, loadActiveQuestions, createCustomQuestion } from './questions.js';
// Load the code for check-ins
import { startNewCheckIn, renderCurrentQuestion, clearQuestionTransitions, finalizeCheckin } from './checkin.js';
// Prepare to export data if necessary
import { exportAllDataAndConfig } from './data-io.js';
// Load the navigation drawer
import { navigateTo } from './ui/navigation.js';
// Set up the hold-to-actuate buttons
import { setupHoldActions } from './ui/hold-actions.js';
// Load modal dialogs
import { setupNoticeDialog, openImportDialog, setupImportDialog, setupNotesDialog, updateNotesButtonLabel } from './ui/dialogs.js';
// Load settings and settings UI
import { setupSettingsAndMenu, setupCanvasBackButtons, applyStoredDisplay } from './ui/settings-menu.js';
// Load history UI
import { renderLineGraph, loadHistoryView } from './ui/history-graph.js';
// Load Questions UI
import { setupQuestionAuthoring, loadQuestionsView } from './ui/question-authoring.js';
// Set up keyboard navigation for accessibility
import { setupKeyboardNavigation } from './ui/keyboard-navigation.js';
// Import safe animation frame requests.
import { safeRAF } from './utils.js';

/**
 * Registers the service worker for offline capability.
 * The service worker is responsible for updating the application when new versions of source files are available.
 * @returns {Promise<ServiceWorkerRegistration | undefined>}
 */
export function registerServiceWorker() {

    if (typeof window !== 'undefined' && window.navigator && 'serviceWorker' in window.navigator) {
        return window.navigator.serviceWorker.register('sw.js').catch(error => {
            console.warn('Service worker registration failed:', error);
        });
    }
    return Promise.resolve(undefined);
}

// Register service worker on window load
if (typeof window !== 'undefined') {
    if (document.readyState === 'complete') {
        registerServiceWorker().catch(error => {
            console.warn('Service worker registration failed:', error);
        });
    } else {
        window.addEventListener('load', () => {
            registerServiceWorker().catch(error => {
                console.warn('Service worker registration failed:', error);
            });
        });
    }
}

export let isAppInitialized = false;

export function resetAppInitialized() {
    isAppInitialized = false;
}

export function initApp() {
    if (isAppInitialized) return Promise.resolve();
    isAppInitialized = true;

    setupHoldActions();
    setupNotesDialog();
    setupImportDialog();
    setupNoticeDialog();
    setupSettingsAndMenu();
    setupQuestionAuthoring();
    setupKeyboardNavigation();
    setupCanvasBackButtons();
    registerServiceWorker().catch(error => {
        console.warn('Service worker registration failed during init:', error);
    });

    const newCheckinButton = document.getElementById('button-new-checkin');
    if (newCheckinButton) {
        newCheckinButton.addEventListener('click', () => {
            startNewCheckIn().catch(error => {
                console.error('Failed to start new check-in:', error);
            });
        });
    }

    const exportButton = document.getElementById('button-export-all');
    if (exportButton) {
        exportButton.addEventListener('click', exportAllDataAndConfig);
    }

    const importFileInput = document.getElementById('file-import');
    if (importFileInput) {
        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (file) {
                openImportDialog(file);
            }
        });
    }

    const importButton = document.getElementById('button-import');
    if (importButton && importFileInput) {
        importButton.addEventListener('click', () => importFileInput.click());
    }

    return initDatabase()
        .then(seedDefaults)
        .then(() => Promise.all([applyStoredDisplay(), loadActiveQuestions()]))
        .then(() => {
            restoreActiveCheckin();
            updateNotesButtonLabel();
            clearQuestionTransitions();

            if (STATE.currentQuestionIndex >= STATE.activeQuestions.length && STATE.activeQuestions.length > 0) {
                const buttonStack = document.getElementById('button-stack');
                if (buttonStack) buttonStack.hidden = true;
                const completionView = document.getElementById('completion-view');
                if (completionView) completionView.hidden = false;
                const footerBox = document.getElementById('footer-box');
                if (footerBox) footerBox.style.display = 'none';
                const progressElement = document.getElementById('progress-text');
                const questionElement = document.getElementById('question-text');
                if (progressElement) progressElement.textContent = "Check-In Complete";
                if (questionElement) questionElement.textContent = "Check-In recorded. Rest easy.";
            } else {
                renderCurrentQuestion();
            }

            const storedView = getStoredActiveView();
            const historyView = (window.history?.state?.view) ? window.history.state.view : null;
            const targetInitialView = storedView || historyView || 'tracker-canvas';

            if (targetInitialView && targetInitialView !== 'tracker-canvas') {
                navigateTo(targetInitialView, { fromPopState: true, instant: true, fromInit: true });
            } else {
                if (window.history?.replaceState) {
                    history.replaceState({ view: 'tracker-canvas' }, '');
                }
            }

            if (typeof window !== 'undefined') {
                window.startNewCheckIn = startNewCheckIn;
                window.renderLineGraph = renderLineGraph;
                window.loadHistoryView = loadHistoryView;
                window.loadQuestionsView = loadQuestionsView;
                window.navigateTo = navigateTo;
                window.finalizeCheckin = finalizeCheckin;
                window.renderCurrentQuestion = renderCurrentQuestion;
                window.createCustomQuestion = createCustomQuestion;
                window.DEFAULT_QUESTIONS = DEFAULT_QUESTIONS;
                window['STATE'] = STATE;
                window.put = put;
                window.getAll = getAll;
                window.getConfig = getConfig;
                window.setConfig = setConfig;
                window.deleteConfig = deleteConfig;
                window.applyStoredDisplay = applyStoredDisplay;
            }

            safeRAF(() => {
                safeRAF(() => {
                    if (typeof document !== 'undefined' && document.body) {
                        document.body.classList.remove('suppress-transitions');
                    }
                });
            });
        })
        .catch(error => {
            console.error('Initialization failed:', error);
            const questionText = document.getElementById('question-text');
            if (questionText) questionText.textContent = "Could not open local storage.";
            safeRAF(() => {
                safeRAF(() => {
                    if (typeof document !== 'undefined' && document.body) {
                        document.body.classList.remove('suppress-transitions');
                    }
                });
            });
        });
}

if (typeof window !== 'undefined') {
    window.startNewCheckIn = startNewCheckIn;
    window.renderLineGraph = renderLineGraph;
    window.navigateTo = navigateTo;
    window.finalizeCheckin = finalizeCheckin;
    window.registerServiceWorker = registerServiceWorker;
    window['STATE'] = STATE;
}

if (typeof document !== 'undefined') {
    const isVitestTestRunner = typeof process !== 'undefined' && (Boolean(process.env?.VITEST) || process.env?.NODE_ENV === 'test');
    if (!isVitestTestRunner) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                initApp().catch(error => {
                    console.error('Unhandled initialization error on DOMContentLoaded:', error);
                });
            });
        } else {
            initApp().catch(error => {
                console.error('Unhandled initialization error:', error);
            });
        }
    }
}
