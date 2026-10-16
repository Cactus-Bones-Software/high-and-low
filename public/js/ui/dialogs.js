/**
 * HIGH & LOW - UI DIALOGS
 * Notice/feedback dialogs, data backup import modals, and check-in note composition dialogs.
 */

import { STATE } from '../state.js';
import { handleFileImport, exportBackup } from '../data-io.js';
import { saveActiveCheckin } from '../storage/session.js';
import { resetHold, updateHoldActionAriaLabels } from './hold-actions.js';
import { t } from '../localization.js';
import { count } from '../storage/db.js';

let noticeReturnFocusElement = null;
let pendingImportFile = null;
let exportReturnFocusElement = null;

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
        labelSpan.textContent = STATE.checkinNote ? t('tracker.noteAttached') : t('tracker.addNote');
    }
    updateHoldActionAriaLabels();
}

/**
 * Updates the export summary text and the enabled state of the modal Export button
 * based on the currently checked scope checkboxes and live database record counts.
 * @returns {Promise<{ entriesCount: number, questionsCount: number, summaryText: string, isExportDisabled: boolean }>}
 */
export async function updateExportSummary() {
    const historyCheckbox = document.getElementById('export-scope-history');
    const settingsCheckbox = document.getElementById('export-scope-settings');
    const summaryTextElement = document.getElementById('export-summary-text');
    const exportSubmitButton = document.getElementById('button-export-submit');

    const includeHistory = Boolean(historyCheckbox?.checked);
    const includeSettings = Boolean(settingsCheckbox?.checked);

    let entriesCount = 0;
    let questionsCount = 0;

    try {
        entriesCount = await count('entries');
        questionsCount = await count('questions');
    } catch (countError) {
        console.warn('Failed to query record counts for export dialog:', countError);
    }

    const entriesLabel = entriesCount === 1
        ? (t('data.entrySingular') || 'Entry')
        : (t('data.entryPlural') || 'Entries');

    let summaryText = '';
    const isExportDisabled = !includeHistory && !includeSettings;

    if (includeHistory && includeSettings) {
        summaryText = t('data.summaryBoth', { entriesCount, entriesLabel, questionsCount });
    } else if (includeHistory) {
        summaryText = t('data.summaryHistoryOnly', { entriesCount, entriesLabel });
    } else if (includeSettings) {
        summaryText = t('data.summarySettingsOnly', { questionsCount });
    } else {
        summaryText = t('data.summaryNone');
    }

    if (summaryTextElement) {
        summaryTextElement.textContent = summaryText;
        if (isExportDisabled) {
            summaryTextElement.classList.add('is-empty');
        } else {
            summaryTextElement.classList.remove('is-empty');
        }
    }

    if (exportSubmitButton) {
        exportSubmitButton.disabled = isExportDisabled;
        if (isExportDisabled) {
            exportSubmitButton.setAttribute('aria-describedby', 'export-summary-text');
        } else {
            exportSubmitButton.removeAttribute('aria-describedby');
        }
    }

    return { entriesCount, questionsCount, summaryText, isExportDisabled };
}

/**
 * Opens the selective export dialog modal, resets scope checkboxes to checked by default,
 * updates summary counts, and sets initial focus on the first checkbox.
 * @param {HTMLElement | string | null} [returnFocusTarget=null] - Trigger element to return focus to on dismiss.
 * @returns {void}
 */
export function openExportDialog(returnFocusTarget = null) {
    const overlay = document.getElementById('export-dialog-overlay');
    if (!overlay) return;

    exportReturnFocusElement = returnFocusTarget || document.getElementById('button-export-choose') || null;

    const historyCheckbox = document.getElementById('export-scope-history');
    const settingsCheckbox = document.getElementById('export-scope-settings');

    if (historyCheckbox) historyCheckbox.checked = true;
    if (settingsCheckbox) settingsCheckbox.checked = true;

    void updateExportSummary();

    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');

    if (historyCheckbox) {
        setTimeout(() => historyCheckbox.focus(), 60);
    }
}

/**
 * Closes the selective export modal dialog, re-applies inert, and returns focus to the opener.
 * @returns {void}
 */
export function closeExportDialog() {
    const overlay = document.getElementById('export-dialog-overlay');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    if (exportReturnFocusElement) {
        const targetElement = typeof exportReturnFocusElement === 'string'
            ? document.getElementById(exportReturnFocusElement)
            : exportReturnFocusElement;
        if (targetElement && typeof targetElement.focus === 'function') {
            targetElement.focus({ preventScroll: true });
        }
        exportReturnFocusElement = null;
    }
}

/**
 * Attaches event listeners for the selective export dialog modal:
 * - Checkbox toggles re-calculate summary and enable/disable the Export button.
 * - Escape closes the dialog.
 * - Tab traps keyboard focus within the modal.
 * - Cancel button and backdrop clicks dismiss the modal.
 * - Export button triggers exportBackup with selected scopes without hold barrier.
 * @returns {void}
 */
export function setupExportDialog() {
    const overlay = document.getElementById('export-dialog-overlay');
    const dialog = document.getElementById('export-dialog');
    const historyCheckbox = document.getElementById('export-scope-history');
    const settingsCheckbox = document.getElementById('export-scope-settings');
    const exportCancelButton = document.getElementById('button-export-cancel');
    const exportSubmitButton = document.getElementById('button-export-submit');

    if (!overlay || !dialog) return;

    const onCheckboxChange = () => {
        void updateExportSummary();
    };

    if (historyCheckbox) {
        historyCheckbox.addEventListener('change', onCheckboxChange);
    }
    if (settingsCheckbox) {
        settingsCheckbox.addEventListener('change', onCheckboxChange);
    }

    if (exportCancelButton) {
        exportCancelButton.addEventListener('click', (event) => {
            event.preventDefault();
            closeExportDialog();
        });
    }

    if (exportSubmitButton) {
        exportSubmitButton.addEventListener('click', (event) => {
            event.preventDefault();
            const includeHistory = Boolean(historyCheckbox?.checked);
            const includeSettings = Boolean(settingsCheckbox?.checked);
            if (!includeHistory && !includeSettings) return;

            closeExportDialog();
            const doExport = (typeof window !== 'undefined' && typeof window.exportBackup === 'function')
                ? window.exportBackup
                : exportBackup;
            void doExport({ includeHistory, includeSettings }).catch((exportError) => {
                console.error('Selective export failed:', exportError);
            });
        });
    }

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeExportDialog();
        }
    });

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeExportDialog();
            return;
        }

        if (event.key === 'Tab') {
            const focusableElements = Array.from(
                dialog.querySelectorAll(
                    'input:not([disabled]):not([type="hidden"]), ' +
                    'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter((focusableElement) => {
                return !focusableElement.hidden && focusableElement.style.display !== 'none';
            });

            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey) {
                if (document.activeElement === firstElement || !dialog.contains(document.activeElement)) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement || !dialog.contains(document.activeElement)) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        }
    });
}