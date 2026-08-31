/**
 * HIGH & LOW - UI VIEW NAVIGATION
 * Canvas switching, slide transitions, active view persistence, and browser history integration.
 */

import { STATE } from '../state.js';
import { saveActiveView } from '../storage/session.js';
import { safeRAF } from '../utils.js';
import { loadHistoryView } from './history-graph.js';
import { loadQuestionsView } from './question-authoring.js';

let currentViewId = 'tracker-canvas';

export function getCurrentViewId() {
    return currentViewId;
}

export function setCurrentViewId(viewId) {
    currentViewId = viewId;
}

function setInertLocal(element, isInert) {
    if (!element) return;
    if (typeof setInert === 'function') {
        setInert(element, isInert);
        return;
    }
    if (typeof window !== 'undefined' && typeof window.setInert === 'function') {
        window.setInert(element, isInert);
        return;
    }
    element.inert = isInert;
    if (isInert) {
        element.setAttribute('inert', '');
    } else {
        element.removeAttribute('inert');
    }
}

export function navigateTo(targetViewId, options = {}) {
    if (targetViewId === currentViewId && !options.force) return;

    const currentCanvas = document.getElementById(currentViewId);
    const targetCanvas = document.getElementById(targetViewId);

    if (!targetCanvas) return;

    if (targetViewId === 'history-canvas') {
        void loadHistoryView().catch(error => {
            console.error('Failed to load history view:', error);
        });
    }

    if (targetViewId === 'questions-canvas') {
        void loadQuestionsView().catch(error => {
            console.error('Failed to load questions view:', error);
        });
    }

    if (targetViewId === 'tracker-canvas') {
        if (STATE.currentQuestionIndex >= STATE.activeQuestions.length && STATE.activeQuestions.length > 0) {
            if (typeof startNewCheckIn === 'function') {
                void startNewCheckIn();
            } else if (typeof window !== 'undefined' && typeof window.startNewCheckIn === 'function') {
                void window.startNewCheckIn();
            }
        }
    }

    const isInstant = Boolean(options.instant || options.fromInit);

    if (isInstant) {
        document.querySelectorAll('.app-canvas').forEach(canvas => {
            if (canvas === targetCanvas) {
                canvas.className = 'app-canvas view-active no-transition';
                setInertLocal(canvas, false);
            } else if (canvas.id === 'tracker-canvas' && targetViewId !== 'tracker-canvas') {
                canvas.className = 'app-canvas view-hidden-left no-transition';
                setInertLocal(canvas, true);
            } else {
                canvas.className = 'app-canvas view-hidden-right no-transition';
                setInertLocal(canvas, true);
            }
        });
        safeRAF(() => {
            safeRAF(() => {
                document.querySelectorAll('.app-canvas.no-transition').forEach(canvasElement => {
                    canvasElement.classList.remove('no-transition');
                });
            });
        });
    } else {
        const isGoingHome = (targetViewId === 'tracker-canvas');

        if (currentCanvas && currentCanvas !== targetCanvas) {
            setInertLocal(currentCanvas, true);
            if (isGoingHome) {
                currentCanvas.className = 'app-canvas view-hidden-right';
            } else {
                currentCanvas.className = 'app-canvas view-hidden-left';
            }
        }

        if (isGoingHome) {
            targetCanvas.className = 'app-canvas view-hidden-left no-transition';
        } else {
            targetCanvas.className = 'app-canvas view-hidden-right no-transition';
        }

        // Force reflow and transition to active
        if (typeof targetCanvas.offsetWidth === 'number') {
            void targetCanvas.offsetWidth;
        }
        targetCanvas.classList.remove('no-transition');
        targetCanvas.className = 'app-canvas view-active';
        setInertLocal(targetCanvas, false);
    }

    currentViewId = targetViewId;
    saveActiveView(targetViewId);

    // Push a history entry so hardware/gesture 'back' steps back one view
    // instead of exiting the app. Skip when we're already responding to
    // a popstate event or during instant loads.
    if (!options.fromPopState && !isInstant && typeof window !== 'undefined' && window.history && window.history.pushState) {
        window.history.pushState({ view: targetViewId }, '');
    }

    // Update active state in drawer items
    document.querySelectorAll('.drawer-nav-button').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-target') === targetViewId);
    });

    // Focus header or first interactive control in target canvas
    const focusTarget = targetCanvas.querySelector('button, select, input, h1');
    if (focusTarget) {
        if (focusTarget.tagName === 'H1' && !focusTarget.hasAttribute('tabindex')) {
            focusTarget.setAttribute('tabindex', '-1');
        }
        focusTarget.focus({ preventScroll: true });
    }
}
