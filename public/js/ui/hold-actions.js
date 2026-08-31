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
    closeNoticeDialog
} from './dialogs.js';

let holdTimer = null;
let isExecutingAction = false;
let isHoldDelayEnabled = true; // Enabled on by default

export function getIsHoldDelayEnabled() {
    return isHoldDelayEnabled;
}

export function setIsHoldDelayEnabled(enabled) {
    isHoldDelayEnabled = Boolean(enabled);
}

export function setupHoldActions() {
    document.querySelectorAll('.hold-action').forEach(button => {
        let holdFinished = false;

        const startHold = () => {
            if (!isHoldDelayEnabled) return;
            holdFinished = false;
            button.classList.add('is-holding');
            clearTimeout(holdTimer);
            holdTimer = setTimeout(() => {
                holdFinished = true;
                executeHoldAction(button.id);
                resetHold(button);
            }, 1500);
        };

        const cancelHold = () => {
            if (!isHoldDelayEnabled) return;
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
                if (isHoldDelayEnabled) startHold();
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
                if (isHoldDelayEnabled) cancelHold();
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
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('pointerleave', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
        } else {
            button.addEventListener('touchstart', () => {
                if (isHoldDelayEnabled) startHold();
            });
            button.addEventListener('touchend', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('touchcancel', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('mousedown', (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                if (isHoldDelayEnabled) startHold();
            });
            button.addEventListener('mouseup', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('mouseleave', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
        }

        // Standard click handler:
        // - When hold delay is enabled: short clicks/taps are ignored because a 1.5s hold is required (except informational notice dismissals).
        // - When hold delay is disabled: executes immediately on regular click/tap.
        button.addEventListener('click', (event) => {
            event.preventDefault();
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

    // Support Enter / Space keypress on the custom file import label
    const importLabel = document.querySelector('label[for="file-import"]');
    if (importLabel) {
        importLabel.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                const fileImportElement = document.getElementById('file-import');
                if (fileImportElement) {
                    fileImportElement.click();
                }
            }
        });
    }
}

export function resetHold(element) {
    clearTimeout(holdTimer);
    if (element && element.classList) {
        element.classList.remove('is-holding');
    }
}

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
    }
}

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
}
