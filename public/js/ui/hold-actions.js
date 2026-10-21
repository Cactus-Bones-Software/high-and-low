/**
 * HIGH & LOW - HOLD ACTION SYSTEM
 * Hold-barrier gesture handlers, timer resets, action execution, and accessibility labels.
 */

import { STATE } from '../state.js';
import { finalizeCheckin } from '../checkin.js';
import {
    openNotesDialog,
    closeNotesDialog,
    saveNotesFromDialog,
    closeImportDialog,
    confirmImport,
    closeNoticeDialog,
    openEraseDialog
} from './dialogs.js';
import { cancelQuestionAuthoring, saveQuestionFromAuthoring } from './question-view.js';

let holdTimer = null;
let isExecutingAction = false;
let isHoldDelayEnabled = true; // Enabled on by default

/**
 * Sets whether the 1.5-second hold confirmation delay is enforced for destructive/hold actions.
 * @param {boolean} enabled - True if hold delay barrier is enabled, false for instant execution.
 * @returns {void}
 */
export function setIsHoldDelayEnabled(enabled) {
    isHoldDelayEnabled = Boolean(enabled);
}

/**
 * Initializes pointer, mouse, touch, and keyboard event handlers across all elements with .hold-action class.
 * Enforces 1500ms continuous hold barrier with pointer capture and visual feedback.
 * @returns {void}
 */
export function setupHoldActions() {
    document.querySelectorAll('.hold-action').forEach(button => {
        const isAlwaysHoldButton = (button.id === 'button-erase-data');

        const startHold = () => {
            const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
            if (!shouldHold || button.disabled) return;
            button.classList.add('is-holding');
            clearTimeout(holdTimer);
            holdTimer = setTimeout(() => {
                executeHoldAction(button.id);
                resetHold(button);
            }, 1500);
        };

        const cancelHold = () => {
            const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
            if (!shouldHold) return;
            clearTimeout(holdTimer);
            button.classList.remove('is-holding');
        };

        // Suppress native context menu and text selection callouts on mobile touch and touch emulation
        button.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });

        if (window.PointerEvent) {
            button.addEventListener('pointerdown', (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                if (typeof button.setPointerCapture === 'function') {
                    try {
                        button.setPointerCapture(event.pointerId);
                    } catch (error) {
                        console.warn('Failed to set pointer capture on hold action button:', error);
                    }
                }
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) startHold();
            });
            button.addEventListener('pointerup', (event) => {
                if (typeof button.releasePointerCapture === 'function') {
                    try {
                        if (typeof button.hasPointerCapture !== 'function' || button.hasPointerCapture(event.pointerId)) {
                            button.releasePointerCapture(event.pointerId);
                        }
                    } catch (error) {
                        console.warn('Failed to release pointer capture on pointerup:', error);
                    }
                }
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) cancelHold();
            });
            button.addEventListener('pointercancel', (event) => {
                if (typeof button.releasePointerCapture === 'function') {
                    try {
                        if (typeof button.hasPointerCapture !== 'function' || button.hasPointerCapture(event.pointerId)) {
                            button.releasePointerCapture(event.pointerId);
                        }
                    } catch (error) {
                        console.warn('Failed to release pointer capture on pointercancel:', error);
                    }
                }
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) cancelHold();
            });
            button.addEventListener('pointerleave', () => {
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) cancelHold();
            });
        } else {
            button.addEventListener('touchstart', () => {
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) startHold();
            });
            button.addEventListener('touchend', () => {
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) cancelHold();
            });
            button.addEventListener('touchcancel', () => {
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) cancelHold();
            });
            button.addEventListener('mousedown', (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) startHold();
            });
            button.addEventListener('mouseup', () => {
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) cancelHold();
            });
            button.addEventListener('mouseleave', () => {
                const shouldHold = isHoldDelayEnabled || isAlwaysHoldButton;
                if (shouldHold) cancelHold();
            });
        }

        // Standard click handler:
        // - When hold delay is enabled: short clicks/taps are ignored because a 1.5s hold is required (except informational notice dismissals).
        // - When hold delay is disabled: executes immediately on regular click/tap, EXCEPT for irreversible actions like Erase All Data.
        button.addEventListener('click', (event) => {
            event.preventDefault();
            if (isAlwaysHoldButton) {
                return;
            }
            if (isHoldDelayEnabled && button.id !== 'button-notice-ok' && button.id !== 'button-question-feedback-ok') {
                return;
            }
            executeHoldAction(button.id);
        });

        // Support Enter / Space keypress on hold action buttons for keyboard accessibility
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                executeHoldAction(button.id);
            }
        });
    });
}

/**
 * Cancels active hold timer and strips .is-holding class from button element.
 * @param {HTMLElement} element - Target hold action button.
 * @returns {void}
 */
export function resetHold(element) {
    clearTimeout(holdTimer);
    if (element?.classList) {
        element.classList.remove('is-holding');
    }
}

/**
 * Executes the discrete application command associated with a hold-action button ID.
 * Debounced to prevent accidental double-execution.
 * @param {string} id - DOM element ID of the action button.
 * @returns {void}
 */
export function executeHoldAction(id) {
    if (isExecutingAction) return;
    isExecutingAction = true;
    setTimeout(() => { isExecutingAction = false; }, 300);

    if (id === 'button-skip') {
        if (typeof finalizeCheckin === 'function') {
            finalizeCheckin();
        } else if (typeof window !== 'undefined' && typeof window.finalizeCheckin === 'function') {
            window.finalizeCheckin();
        }
    } else if (id === 'button-notes') {
        if (typeof openNotesDialog === 'function') {
            openNotesDialog();
        } else if (typeof window !== 'undefined' && typeof window.openNotesDialog === 'function') {
            window.openNotesDialog();
        }
    } else if (id === 'button-note-cancel') {
        if (typeof closeNotesDialog === 'function') {
            closeNotesDialog();
        } else if (typeof window !== 'undefined' && typeof window.closeNotesDialog === 'function') {
            window.closeNotesDialog();
        }
    } else if (id === 'button-note-save') {
        if (typeof saveNotesFromDialog === 'function') {
            saveNotesFromDialog();
        } else if (typeof window !== 'undefined' && typeof window.saveNotesFromDialog === 'function') {
            window.saveNotesFromDialog();
        }
    } else if (id === 'button-import-cancel') {
        if (typeof closeImportDialog === 'function') {
            closeImportDialog();
        } else if (typeof window !== 'undefined' && typeof window.closeImportDialog === 'function') {
            window.closeImportDialog();
        }
    } else if (id === 'button-import-merge') {
        if (typeof confirmImport === 'function') {
            confirmImport('merge');
        } else if (typeof window !== 'undefined' && typeof window.confirmImport === 'function') {
            window.confirmImport('merge');
        }
    } else if (id === 'button-import-replace') {
        if (typeof confirmImport === 'function') {
            confirmImport('replace');
        } else if (typeof window !== 'undefined' && typeof window.confirmImport === 'function') {
            window.confirmImport('replace');
        }
    } else if (id === 'button-question-feedback-ok' || id === 'button-notice-ok') {
        if (typeof closeNoticeDialog === 'function') {
            closeNoticeDialog();
        } else if (typeof window !== 'undefined' && typeof window.closeNoticeDialog === 'function') {
            window.closeNoticeDialog();
        }
    } else if (id === 'button-cancel-question') {
        if (typeof cancelQuestionAuthoring === 'function') {
            cancelQuestionAuthoring();
        } else if (typeof window !== 'undefined' && typeof window.cancelQuestionAuthoring === 'function') {
            window.cancelQuestionAuthoring();
        }
    } else if (id === 'button-save-question') {
        const saveQuestionButton = document.getElementById('button-save-question');
        if (saveQuestionButton?.disabled) return;
        if (typeof saveQuestionFromAuthoring === 'function') {
            void saveQuestionFromAuthoring();
        } else if (typeof window !== 'undefined' && typeof window.saveQuestionFromAuthoring === 'function') {
            void window.saveQuestionFromAuthoring();
        }
    } else if (id === 'button-archive-question') {
        if (typeof archiveQuestionFromAuthoring === 'function') {
            void archiveQuestionFromAuthoring();
        } else if (typeof window !== 'undefined' && typeof window.archiveQuestionFromAuthoring === 'function') {
            void window.archiveQuestionFromAuthoring();
        }
    } else if (id === 'button-erase-data') {
        if (typeof openEraseDialog === 'function') {
            openEraseDialog('button-erase-data');
        } else if (typeof window !== 'undefined' && typeof window.openEraseDialog === 'function') {
            window.openEraseDialog('button-erase-data');
        }
    }
}

/**
 * Updates accessible aria-labels on hold action buttons to indicate whether hold-to-confirm is required.
 * @returns {void}
 */
export function updateHoldActionAriaLabels() {
    const skipButton = document.getElementById('button-skip');
    if (skipButton) {
        skipButton.setAttribute('aria-label', isHoldDelayEnabled ? 'Skip remaining questions (Hold to confirm)' : 'Skip remaining questions');
    }
    const notesButton = document.getElementById('button-notes');
    if (notesButton) {
        const noteStateText = STATE.checkinNote ? 'Note Attached' : 'Add custom note';
        notesButton.setAttribute('aria-label', isHoldDelayEnabled ? `${noteStateText} (Hold to confirm)` : noteStateText);
    }
    const archiveButton = document.getElementById('button-archive-question');
    if (archiveButton) {
        archiveButton.setAttribute('aria-label', isHoldDelayEnabled ? 'Remove question (Hold to confirm)' : 'Remove question');
    }
    const eraseButton = document.getElementById('button-erase-data');
    if (eraseButton) {
        eraseButton.setAttribute('aria-label', 'Erase All Data (Hold to confirm)');
    }
}
