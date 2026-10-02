/**
 * HIGH & LOW - UI DIALOGS
 * Notice/feedback dialogs, data backup import modals, and check-in note composition dialogs.
 */

import { STATE } from '../state.js';
import { handleFileImport } from '../data-io.js';
import { saveActiveCheckin } from '../storage/session.js';
import { resetHold, updateHoldActionAriaLabels } from './hold-actions.js';

let noticeReturnFocusElement = null;
let pendingImportFile = null;

/**
 * Displays a notice or feedback modal dialog with custom title and subtitle.
 * Manages accessibility attributes, removes inert, and sets focus on confirmation button.
 * @param {string} title - Heading text for the notice dialog.
 * @param {string} subtitle - Body text or explanation.
 * @param {HTMLElement | string | null} [returnFocusTarget=null] - Element or ID to return focus to on dismiss.
 * @param {boolean} [isNote=false] - Whether the content is a check-in note (applies note typography styling).
 * @returns {void}
 */
export function showNoticeDialog(title, subtitle, returnFocusTarget, isNote = false) {
    noticeReturnFocusElement = returnFocusTarget || null;
    const overlay = document.getElementById('notice-dialog-overlay') ||
        document.getElementById('question-feedback-dialog-overlay');
    const titleElement = document.getElementById('notice-dialog-title') ||
        document.getElementById('question-feedback-title');
    const subtitleElement = document.getElementById('notice-dialog-subtitle') ||
        document.getElementById('question-feedback-subtitle');
    if (!overlay) return;

    if (titleElement) titleElement.textContent = title;
    if (subtitleElement) {
        subtitleElement.textContent = subtitle;
        if (isNote) {
            subtitleElement.classList.add('notice-note-content');
        } else {
            subtitleElement.classList.remove('notice-note-content');
        }
    }

    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');

    const okButton = document.getElementById('button-notice-ok') ||
        document.getElementById('button-question-feedback-ok');
    if (okButton) setTimeout(() => okButton.focus(), 60);
}

/**
 * Closes the active notice dialog, re-applies inert, and returns focus to the triggering element.
 * @returns {void}
 */
export function closeNoticeDialog() {
    const overlay = document.getElementById('notice-dialog-overlay') ||
        document.getElementById('question-feedback-dialog-overlay');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    const dialog = document.getElementById('notice-dialog') ||
        document.getElementById('question-feedback-dialog');
    if (dialog) {
        for (const button of dialog.querySelectorAll('.hold-action')) {
            resetHold(button);
        }
    }

    if (noticeReturnFocusElement) {
        const element = typeof noticeReturnFocusElement === 'string'
            ? document.getElementById(noticeReturnFocusElement)
            : noticeReturnFocusElement;
        if (element && typeof element.focus === 'function') {
            element.focus({ preventScroll: true });
        }
        noticeReturnFocusElement = null;
    }
}

/**
 * Attaches Escape/Enter keydown listeners and OK button click listeners to notice dialogs.
 * @returns {void}
 */
export function setupNoticeDialog() {
    const overlay = document.getElementById('notice-dialog-overlay') ||
        document.getElementById('question-feedback-dialog-overlay');
    if (!overlay) return;

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Enter') {
            event.preventDefault();
            closeNoticeDialog();
        }
    });

    const okButton = document.getElementById('button-notice-ok') ||
        document.getElementById('button-question-feedback-ok');
    if (okButton) {
        okButton.addEventListener('click', (event) => {
            event.preventDefault();
            closeNoticeDialog();
        });
    }
}

/**
 * Opens the file import modal with mode choices (Smart Merge vs Wipe & Replace) for a staged JSON file.
 * @param {File} file - Selected backup file.
 * @returns {void}
 */
export function openImportDialog(file) {
    if (!file) return;
    pendingImportFile = file;

    const overlay = document.getElementById('import-dialog-overlay');
    const nameElement = document.getElementById('import-file-name');
    if (!overlay) return;

    if (nameElement) {
        nameElement.textContent = file.name || 'backup.json';
    }

    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');

    const mergeButton = document.getElementById('button-import-merge');
    if (mergeButton) setTimeout(() => mergeButton.focus(), 60);
}

/**
 * Closes the file import modal and resets the file input field.
 * @returns {void}
 */
export function closeImportDialog() {
    const overlay = document.getElementById('import-dialog-overlay');
    const fileInput = document.getElementById('file-import');
    if (fileInput) fileInput.value = '';
    pendingImportFile = null;

    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    for (const button of document.querySelectorAll('#import-dialog .hold-action')) {
        resetHold(button);
    }
}

/**
 * Confirms backup import in specified mode and delegates to the data-io import engine.
 * @param {'replace' | 'merge'} mode - Import strategy ('replace' or 'merge').
 * @returns {void}
 */
export function confirmImport(mode) {
    const file = pendingImportFile;
    closeImportDialog();
    if (file) {
        handleFileImport(file, mode);
    }
}

/**
 * Binds Escape key listener on the file import dialog overlay.
 * @returns {void}
 */
export function setupImportDialog() {
    const overlay = document.getElementById('import-dialog-overlay');
    if (!overlay) return;

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeImportDialog();
        }
    });
}

/**
 * Opens the check-in custom note composition dialog, populates current note, and focuses input textarea.
 * @returns {void}
 */
export function openNotesDialog() {
    const overlay = document.getElementById('notes-dialog-overlay');
    const input = document.getElementById('checkin-note-input');
    if (!overlay || !input) return;

    input.value = STATE.checkinNote || '';
    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');

    // Smooth focus and cursor positioning
    setTimeout(() => {
        input.focus();
        const length = input.value.length;
        input.setSelectionRange(length, length);
    }, 60);
}

/**
 * Closes the notes dialog, re-applies inert, and returns focus to the notes button on tracker canvas.
 * @returns {void}
 */
export function closeNotesDialog() {
    const overlay = document.getElementById('notes-dialog-overlay');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    // Reset hold visual indicator state on dialog buttons
    for (const button of document.querySelectorAll('#notes-dialog .hold-action')) {
        resetHold(button);
    }

    // Return focus to notes button on the tracker canvas
    const notesButton = document.getElementById('button-notes');
    if (notesButton) notesButton.focus({ preventScroll: true });
}

/**
 * Saves note text from the modal input into active check-in state, updates button label, and closes dialog.
 * @returns {void}
 */
export function saveNotesFromDialog() {
    const input = document.getElementById('checkin-note-input');
    if (input) {
        const note = input.value.trim();
        STATE.checkinNote = note.length > 0 ? note : null;
        updateNotesButtonLabel();
        saveActiveCheckin();
    }
    closeNotesDialog();
}

/**
 * Binds Escape and Ctrl/Cmd+Enter keyboard shortcuts to the notes composition modal.
 * @returns {void}
 */
export function setupNotesDialog() {
    const overlay = document.getElementById('notes-dialog-overlay');
    const input = document.getElementById('checkin-note-input');
    if (!overlay || !input) return;

    // Handle Escape and Ctrl/Cmd+Enter inside the modal
    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeNotesDialog();
        }
    });

    input.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            saveNotesFromDialog();
        }
    });
}

/**
 * Updates the notes toggle button label on tracker canvas depending on whether a note is attached.
 * @returns {void}
 */
export function updateNotesButtonLabel() {
    const notesButton = document.getElementById('button-notes');
    if (!notesButton) return;
    const labelSpan = notesButton.querySelector('.button-label');
    if (labelSpan) {
        labelSpan.textContent = STATE.checkinNote ? 'Note Attached ✓' : 'Add Note';
    }
    updateHoldActionAriaLabels();
}
