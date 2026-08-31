/**
 * HIGH & LOW - MAIN APPLICATION ENTRY POINT
 * Bootstrap sequence, module wiring, database seeding, and runtime initialization.
 */

import { STATE } from './state.js';
import { initDatabase, put, getAll, getConfig, setConfig, deleteConfig } from './storage/db.js';
import { restoreActiveCheckin, getStoredActiveView } from './storage/session.js';
import { DEFAULT_QUESTIONS, seedDefaults, loadActiveQuestions, createCustomQuestion } from './questions.js';
import { startNewCheckIn, renderCurrentQuestion, clearQuestionTransitions, finalizeCheckin } from './checkin.js';
import { exportAllDataAndConfig } from './data-io.js';
import { navigateTo } from './ui/navigation.js';
import { setupHoldActions } from './ui/hold-actions.js';
import { setupNoticeDialog, openImportDialog, setupImportDialog, setupNotesDialog, updateNotesButtonLabel } from './ui/dialogs.js';
import { setupSettingsAndMenu, setupCanvasBackButtons, applyStoredDisplay } from './ui/settings-menu.js';
import { renderLineGraph, loadHistoryView } from './ui/history-graph.js';
import { setupQuestionAuthoring } from './ui/question-authoring.js';
import { setupKeyboardNavigation } from './ui/keyboard-navigation.js';
import { safeRAF } from './utils.js';

// Register service worker if available
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.warn('Service worker registration failed:', error);
        });
    });
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

    const newCheckinButton = document.getElementById('button-new-checkin');
    if (newCheckinButton) {
        newCheckinButton.addEventListener('click', () => {
            void startNewCheckIn();
        });
    }

    const exportButton = document.getElementById('button-export-all');
    if (exportButton) {
        exportButton.addEventListener('click', exportAllDataAndConfig);
    }

    const importFileInput = document.getElementById('file-import');
    if (importFileInput) {
        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (file) {
                openImportDialog(file);
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
                if (progressElement) progressElement.textContent = "Check-In Complete";
                if (questionElement) questionElement.textContent = "Check-In recorded. Rest easy.";
            } else {
                renderCurrentQuestion();
            }

            const storedView = getStoredActiveView();
            const historyView = (window.history && window.history.state && window.history.state.view) ? window.history.state.view : null;
            const targetInitialView = storedView || historyView || 'tracker-canvas';

            if (targetInitialView && targetInitialView !== 'tracker-canvas') {
                navigateTo(targetInitialView, { fromPopState: true, instant: true, fromInit: true });
            } else {
                if (window.history && window.history.replaceState) {
                    history.replaceState({ view: 'tracker-canvas' }, '');
                }
            }

            if (typeof window !== 'undefined') {
                window.startNewCheckIn = startNewCheckIn;
                window.renderLineGraph = renderLineGraph;
                window.loadHistoryView = loadHistoryView;
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
    window['STATE'] = STATE;
}

if (typeof document !== 'undefined') {
    const isVitestTestRunner = typeof process !== 'undefined' && (Boolean(process.env?.VITEST) || process.env?.NODE_ENV === 'test');
    if (!isVitestTestRunner) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => void initApp());
        } else {
            void initApp();
        }
    }
}
