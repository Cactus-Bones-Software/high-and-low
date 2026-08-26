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

export function showNoticeDialog(title, subtitle, returnFocusTarget, isNote = false) {
    noticeReturnFocusElement = returnFocusTarget || null;
    const overlay = document.getElementById('notice-dialog-overlay') || document.getElementById('question-feedback-dialog-overlay');
    const titleElement = document.getElementById('notice-dialog-title') || document.getElementById('question-feedback-title');
    const subtitleElement = document.getElementById('notice-dialog-subtitle') || document.getElementById('question-feedback-subtitle');
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

    const okButton = document.getElementById('button-notice-ok') || document.getElementById('button-question-feedback-ok');
    if (okButton) setTimeout(() => okButton.focus(), 60);
}

export function closeNoticeDialog() {
    const overlay = document.getElementById('notice-dialog-overlay') || document.getElementById('question-feedback-dialog-overlay');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    const dialog = document.getElementById('notice-dialog') || document.getElementById('question-feedback-dialog');
    if (dialog) {
        dialog.querySelectorAll('.hold-action').forEach(button => resetHold(button));
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

export function setupNoticeDialog() {
    const overlay = document.getElementById('notice-dialog-overlay') || document.getElementById('question-feedback-dialog-overlay');
    if (!overlay) return;

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Enter') {
            event.preventDefault();
            closeNoticeDialog();
        }
    });

    const okButton = document.getElementById('button-notice-ok') || document.getElementById('button-question-feedback-ok');
    if (okButton) {
        okButton.addEventListener('click', (event) => {
            event.preventDefault();
            closeNoticeDialog();
        });
    }
}

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

export function closeImportDialog() {
    const overlay = document.getElementById('import-dialog-overlay');
    const fileInput = document.getElementById('file-import');
    if (fileInput) fileInput.value = '';
    pendingImportFile = null;

    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    document.querySelectorAll('#import-dialog .hold-action').forEach(button => resetHold(button));
}

export function confirmImport(mode) {
    const file = pendingImportFile;
    closeImportDialog();
    if (file) {
        handleFileImport(file, mode);
    }
}

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

export function closeNotesDialog() {
    const overlay = document.getElementById('notes-dialog-overlay');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    // Reset hold visual indicator state on dialog buttons
    document.querySelectorAll('#notes-dialog .hold-action').forEach(button => resetHold(button));

    // Return focus to notes button on the tracker canvas
    const notesButton = document.getElementById('button-notes');
    if (notesButton) notesButton.focus({ preventScroll: true });
}

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

export function updateNotesButtonLabel() {
    const notesButton = document.getElementById('button-notes');
    if (!notesButton) return;
    const labelSpan = notesButton.querySelector('.button-label');
    if (labelSpan) {
        labelSpan.textContent = STATE.checkinNote ? 'Note Attached ✓' : 'Add Note';
    }
    updateHoldActionAriaLabels();
}
