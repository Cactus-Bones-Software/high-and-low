/**
 * HIGH & LOW - MAIN APPLICATION ENTRY POINT
 * Bootstrap sequence, module wiring, database seeding, and runtime initialization.
 */

// Grab the STATE object.
import { STATE } from './state.js';
// Prepare to grab data from storage
import { initDatabase, get, put, getAll, getConfig, setConfig, deleteConfig } from './storage/db.js';
// Prepare to grab session details if not stale
import { restoreActiveCheckin, getStoredActiveView } from './storage/session.js';
// Load default questions, then prepare to load, create, remove, and restore questions
import { DEFAULT_QUESTIONS,
    seedDefaults,
    loadActiveQuestions,
    createCustomQuestion,
    updateCustomQuestion,
    archiveQuestion,
    restoreQuestion,
    archiveCustomQuestion,
    restoreCustomQuestion
} from './questions.js';
// Load the code for check-ins
import { startNewCheckIn, renderCurrentQuestion, clearQuestionTransitions, finalizeCheckin } from './checkin.js';
// Prepare to export data if necessary
import { exportAllDataAndConfig } from './data-io.js';
// Load the navigation drawer
import { navigateTo } from './ui/navigation.js';
// Set up the hold-to-actuate buttons
import { setupHoldActions } from './ui/hold-actions.js';
// Load modal dialogs
import { setupNoticeDialog, showNoticeDialog, openImportDialog, setupImportDialog, setupNotesDialog, updateNotesButtonLabel } from './ui/dialogs.js';
// Load settings and settings UI
import { setupSettingsAndMenu, setupCanvasBackButtons, applyStoredDisplay } from './ui/settings-menu.js';
// Load history UI
import {
    renderLineGraph,
    loadHistoryView,
    setupGraphGestureZoom,
    calculatePinchDistance,
    calculatePinchMidpoint,
    calculateWheelZoomDeltaMultiplier,
    calculateGestureTransform,
    applyGraphGestureTransform,
    resetGraphGestureTransform
} from './ui/history-graph.js';
// Load Questions UI
import { setupQuestionAuthoring, loadQuestionsView } from './ui/question-view.js';
// Set up keyboard navigation for accessibility
import { setupKeyboardNavigation } from './ui/keyboard-navigation.js';
// Import safe animation frame requests.
import { safeRAF } from './utils.js';
// Import translation lookup
import { t } from './localization.js';

export let isRefreshingTab = false;
export let activeServiceWorkerRegistration = null;

/**
 * Triggers a browser location reload to activate newly installed service worker updates.
 * Safely guards against environments where window.location.reload is unavailable.
 * @returns {void}
 */
export function reloadActiveTab() {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        try {
            window.location.reload();
        } catch {
            // Ignore environments where location.reload is restricted
        }
    }
}

/**
 * Attaches lifecycle listeners to track service worker state changes, updates, controller changes,
 * and application visibility / focus resume checks (Task 6.3).
 *
 * @param {ServiceWorkerRegistration} registration - Active service worker registration
 */
export function setupServiceWorkerLifecycle(registration) {
    if (!registration) return;
    activeServiceWorkerRegistration = registration;

    function handleInstallingWorker(installingWorker) {
        if (!installingWorker) return;
        installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
                if (window.navigator?.serviceWorker?.controller) {
                    // A new version is installed and ready to take control
                    if (typeof showNoticeDialog === 'function') {
                        showNoticeDialog(
                            'Update Ready',
                            'A new version of High & Low has been downloaded. Updating your session...',
                            null
                        );
                    }
                }
            }
        });
    }

    if (registration.installing) {
        handleInstallingWorker(registration.installing);
    }

    registration.addEventListener('updatefound', () => {
        handleInstallingWorker(registration.installing);
    });

    // Listen for controllerchange events to reload active tabs when new service worker takes over
    if (typeof window.navigator?.serviceWorker?.addEventListener === 'function' && !window.navigator.serviceWorker._hasControllerChangeListener) {
        window.navigator.serviceWorker._hasControllerChangeListener = true;
        window.navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (isRefreshingTab) return;
            isRefreshingTab = true;
            if (typeof window.reloadActiveTab === 'function') {
                window.reloadActiveTab();
            } else {
                reloadActiveTab();
            }
        });
    }

    // App lifecycle re-checks: trigger registration.update() when resuming from background
    if (typeof document !== 'undefined' && !document._hasServiceWorkerVisibilityListener) {
        document._hasServiceWorkerVisibilityListener = true;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && activeServiceWorkerRegistration) {
                activeServiceWorkerRegistration.update().catch(error => {
                    console.warn('Failed to check for service worker update on visibility change:', error);
                });
            }
        });
    }

    if (typeof window !== 'undefined' && !window._hasServiceWorkerFocusListener) {
        window._hasServiceWorkerFocusListener = true;
        window.addEventListener('focus', () => {
            if (activeServiceWorkerRegistration) {
                activeServiceWorkerRegistration.update().catch(error => {
                    console.warn('Failed to check for service worker update on window focus:', error);
                });
            }
        });
    }
}

/**
 * Registers the service worker for offline capability and sets up lifecycle event listeners.
 * @returns {Promise<ServiceWorkerRegistration | undefined>}
 */
export function registerServiceWorker() {
    if (typeof window !== 'undefined' && window.navigator && 'serviceWorker' in window.navigator) {
        return window.navigator.serviceWorker.register('sw.js', { scope: './' })
            .then(registration => {
                if (registration) {
                    setupServiceWorkerLifecycle(registration);
                }
                return registration;
            })
            .catch(error => {
                console.warn('Service worker registration failed:', error);
                return undefined;
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

/**
 * Resets the application initialization guard flag (primarily used in test harness teardown).
 * @returns {void}
 */
export function resetAppInitialized() {
    isAppInitialized = false;
}

/**
 * Bootstraps the application runtime: opens IndexedDB, seeds defaults, loads questions and settings,
 * wires DOM event listeners for check-in controls, navigation, and modal dialogs, and renders initial view.
 * @returns {Promise<void>} Resolves when asynchronous startup completes.
 */
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
        importButton.addEventListener('click', () => {
            importFileInput.value = '';
            importFileInput.click();
        });
    }

    const importZone = document.querySelector('.file-import-zone');
    if (importZone) {
        const preventDefaultAction = (event) => {
            event.preventDefault();
            event.stopPropagation();
        };

        ['dragenter', 'dragover'].forEach((eventName) => {
            importZone.addEventListener(eventName, (event) => {
                preventDefaultAction(event);
                importZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach((eventName) => {
            importZone.addEventListener(eventName, (event) => {
                preventDefaultAction(event);
                importZone.classList.remove('drag-over');
            });
        });

        importZone.addEventListener('drop', (event) => {
            preventDefaultAction(event);
            const droppedFile = event.dataTransfer?.files?.[0];
            if (droppedFile) {
                openImportDialog(droppedFile);
            }
        });
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
                if (progressElement) progressElement.textContent = t('tracker.completeTitle');
                if (questionElement) questionElement.textContent = t('tracker.completeSubtitle');
            } else {
                renderCurrentQuestion();
            }

            const storedView = getStoredActiveView();
            const historyView = window.history?.state?.view ? window.history.state.view : null;
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
                window.setupGraphGestureZoom = setupGraphGestureZoom;
                window.calculatePinchDistance = calculatePinchDistance;
                window.calculatePinchMidpoint = calculatePinchMidpoint;
                window.calculateWheelZoomDeltaMultiplier = calculateWheelZoomDeltaMultiplier;
                window.loadHistoryView = loadHistoryView;
                window.loadQuestionsView = loadQuestionsView;
                window.navigateTo = navigateTo;
                window.finalizeCheckin = finalizeCheckin;
                window.registerServiceWorker = registerServiceWorker;
                window.setupServiceWorkerLifecycle = setupServiceWorkerLifecycle;
                window.reloadActiveTab = reloadActiveTab;
                window.renderCurrentQuestion = renderCurrentQuestion;
                window.createCustomQuestion = createCustomQuestion;
                window.updateCustomQuestion = updateCustomQuestion;
                window.archiveQuestion = archiveQuestion;
                window.restoreQuestion = restoreQuestion;
                window.archiveCustomQuestion = archiveCustomQuestion;
                window.restoreCustomQuestion = restoreCustomQuestion;
                window.removeQuestion = archiveQuestion;
                window.removeCustomQuestion = archiveQuestion;
                window.DEFAULT_QUESTIONS = DEFAULT_QUESTIONS;
                window.STATE = STATE;
                window.put = put;
                window.get = get;
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
            if (questionText) questionText.textContent = t('tracker.storageError');
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
    window.setupGraphGestureZoom = setupGraphGestureZoom;
    window.calculatePinchDistance = calculatePinchDistance;
    window.calculatePinchMidpoint = calculatePinchMidpoint;
    window.calculateWheelZoomDeltaMultiplier = calculateWheelZoomDeltaMultiplier;
    window.calculateGestureTransform = calculateGestureTransform;
    window.applyGraphGestureTransform = applyGraphGestureTransform;
    window.resetGraphGestureTransform = resetGraphGestureTransform;
    window.navigateTo = navigateTo;
    window.finalizeCheckin = finalizeCheckin;
    window.registerServiceWorker = registerServiceWorker;
    window.setupServiceWorkerLifecycle = setupServiceWorkerLifecycle;
    window.reloadActiveTab = reloadActiveTab;
    window.STATE = STATE;
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