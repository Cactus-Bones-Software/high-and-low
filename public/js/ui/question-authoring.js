/**
 * HIGH & LOW - QUESTION AUTHORING UI
 * Custom question authoring form, live curve preview, form validation, and question library additions.
 */

import { normalizeQuestionText, createCustomQuestion } from '../questions.js';
import { buildScoreButtonsHTML } from '../checkin.js';
import { showNoticeDialog } from './dialogs.js';

export function setupQuestionAuthoring() {
    const toggleButton = document.getElementById('button-add-question');
    const form = document.getElementById('question-form');
    const textInput = document.getElementById('q-text');
    const shortLabelInput = document.getElementById('q-short-label');
    const curveInput = document.getElementById('q-curve');
    const maxInput = document.getElementById('q-max-label');
    const midField = document.getElementById('field-mid-label');
    const midInput = document.getElementById('q-mid-label');
    const minInput = document.getElementById('q-min-label');
    const preview = document.getElementById('question-preview');
    const previewTitleBox = document.getElementById('preview-title-box');
    const previewStack = document.getElementById('question-preview-stack');
    const addToSetInput = document.getElementById('q-add-to-set');
    const saveButton = document.getElementById('button-save-question');
    const cancelButton = document.getElementById('button-cancel-question');

    if (!toggleButton || !form || !textInput || !curveInput || !maxInput || !midField || !midInput || !minInput || !preview || !previewStack || !saveButton || !cancelButton) {
        return;
    }

    function refreshPreview() {
        const curve = curveInput.value;
        preview.setAttribute('data-curve', curve);
        const shortValue = normalizeQuestionText(shortLabelInput ? shortLabelInput.value : '');
        const fullValue = normalizeQuestionText(textInput ? textInput.value : '');
        if (previewTitleBox) {
            previewTitleBox.textContent = shortValue ? shortValue : (fullValue || 'Short Label Preview');
        }
        previewStack.innerHTML = buildScoreButtonsHTML({
            curve,
            maxLabel: maxInput.value,
            minLabel: minInput.value,
            midLabel: midInput.value
        });
    }

    function syncMidVisibility() {
        midField.hidden = curveInput.value !== 'middle-is-best';
    }

    function syncSaveEnabled() {
        const isTextValid = normalizeQuestionText(textInput.value) !== '';
        const isShortLabelValid = shortLabelInput ? normalizeQuestionText(shortLabelInput.value) !== '' : true;
        saveButton.disabled = !(isTextValid && isShortLabelValid);
    }

    function resetForm() {
        form.reset();
        syncMidVisibility();
        syncSaveEnabled();
        refreshPreview();
    }

    toggleButton.addEventListener('click', () => {
        const opening = form.hidden;
        form.hidden = !opening;
        toggleButton.textContent = opening ? 'Hide Form' : 'Add a Question';
        toggleButton.setAttribute('aria-expanded', opening ? 'true' : 'false');
        if (opening) {
            resetForm();
            textInput.focus({ preventScroll: true });
        }
    });

    curveInput.addEventListener('change', () => {
        syncMidVisibility();
        refreshPreview();
    });

    [textInput, shortLabelInput, maxInput, midInput, minInput].forEach(inputElement => {
        if (!inputElement) return;
        inputElement.addEventListener('input', () => {
            syncSaveEnabled();
            refreshPreview();
        });
    });

    cancelButton.addEventListener('click', () => {
        resetForm();
        form.hidden = true;
        toggleButton.textContent = 'Add a Question';
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.focus({ preventScroll: true });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        saveButton.disabled = true;
        try {
            const outcome = await createCustomQuestion({
                text: textInput.value,
                shortLabel: shortLabelInput ? shortLabelInput.value : '',
                curve: curveInput.value,
                minLabel: minInput.value,
                maxLabel: maxInput.value,
                midLabel: midInput.value,
                addToSet: addToSetInput ? addToSetInput.checked : false
            });

            if (outcome.status === 'added') {
                showNoticeDialog('Question Saved', 'Your custom question has been saved and will appear in your check-in tracker.', toggleButton);
            } else if (outcome.status === 'restored') {
                showNoticeDialog('Question Restored', 'That question already existed in your archived items and has been restored.', toggleButton);
            } else {
                showNoticeDialog('Question Exists', 'You already have an active question with this text in your library.', toggleButton);
            }

            resetForm();
            form.hidden = true;
            toggleButton.textContent = 'Add a Question';
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.focus({ preventScroll: true });
        } catch (error) {
            console.error('Failed to save question:', error);
            showNoticeDialog('Could Not Save', 'Could not save the question. Please check the fields and try again.', toggleButton);
            syncSaveEnabled();
        }
    });

    syncMidVisibility();
    syncSaveEnabled();
    refreshPreview();
}
