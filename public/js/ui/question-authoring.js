/**
 * HIGH & LOW - QUESTION AUTHORING UI
 * Questions library view, search, read-only cards, and custom question modal authoring.
 */

import { normalizeQuestionText, createCustomQuestion, loadActiveQuestions } from '../questions.js';
import { getAll, getConfig } from '../storage/db.js';
import { buildScoreButtonsHTML } from '../checkin.js';
import { showNoticeDialog } from './dialogs.js';
import { resetHold } from './hold-actions.js';
import { escapeHTML, html, rawHTML } from '../utils.js';

let cancelAuthoringHandler = null;
let saveAuthoringHandler = null;

export function cancelQuestionAuthoring() {
    if (cancelAuthoringHandler) cancelAuthoringHandler();
}

export async function saveQuestionFromAuthoring() {
    if (saveAuthoringHandler) await saveAuthoringHandler();
}

export function questionMatchesSearch(question, searchQuery) {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;

    const searchableParts = [
        question.text || '',
        question.shortLabel || '',
        ...(Array.isArray(question.tags) ? question.tags : [])
    ];

    return searchableParts.some(part => part.toLowerCase().includes(normalizedQuery));
}

export function partitionQuestionsForView(allQuestions, activeSetIds, searchQuery) {
    const activeIdSet = new Set(Array.isArray(activeSetIds) ? activeSetIds : []);
    const questionsById = new Map(allQuestions.map(question => [question.id, question]));

    const activeQuestions = (Array.isArray(activeSetIds) ? activeSetIds : [])
        .map(id => questionsById.get(id))
        .filter(question => question && !question.archived && questionMatchesSearch(question, searchQuery));

    const catalogQuestions = allQuestions
        .filter(question => !question.archived && !activeIdSet.has(question.id) && questionMatchesSearch(question, searchQuery))
        .sort((left, right) => {
            const leftLabel = (left.shortLabel || left.text || '').toLowerCase();
            const rightLabel = (right.shortLabel || right.text || '').toLowerCase();
            return leftLabel.localeCompare(rightLabel);
        });

    return { activeQuestions, catalogQuestions };
}

function buildQuestionCardHTML(question) {
    const statusLabel = question.builtIn ? 'Built-in' : 'Custom';
    const statusClass = question.builtIn ? 'question-card-badge-builtin' : 'question-card-badge-custom';
    const tags = Array.isArray(question.tags) ? question.tags : [];
    const tagChipsHTML = tags
        .map(tag => `<span class="question-tag-chip">${escapeHTML(tag)}</span>`)
        .join('');
    const tagsHTML = tags.length > 0
        ? `<div class="question-card-tags" aria-label="Tags">${tagChipsHTML}</div>`
        : '';

    return html`
        <li class="question-card" data-question-id="${question.id}">
            <div class="question-card-header">
                <p class="question-card-text">${question.text}</p>
                <span class="question-card-badge ${statusClass}">${statusLabel}</span>
            </div>
            <p class="question-card-short-label">${question.shortLabel || ''}</p>
            ${rawHTML(tagsHTML)}
        </li>
    `;
}

export async function loadQuestionsView() {
    const activeList = document.getElementById('questions-active-list');
    const catalogList = document.getElementById('questions-catalog-list');
    const activeEmpty = document.getElementById('questions-active-empty');
    const catalogEmpty = document.getElementById('questions-catalog-empty');
    const searchInput = document.getElementById('questions-search-input');

    if (!activeList || !catalogList) return;

    const searchQuery = searchInput ? searchInput.value : '';
    const [allQuestions, activeSetIds] = await Promise.all([
        getAll('questions'),
        getConfig('activeQuestionSet')
    ]);

    const { activeQuestions, catalogQuestions } = partitionQuestionsForView(
        allQuestions,
        activeSetIds,
        searchQuery
    );

    activeList.innerHTML = activeQuestions.map(buildQuestionCardHTML).join('');
    catalogList.innerHTML = catalogQuestions.map(buildQuestionCardHTML).join('');

    if (activeEmpty) activeEmpty.hidden = activeQuestions.length > 0;
    if (catalogEmpty) catalogEmpty.hidden = catalogQuestions.length > 0;
}

export function setupQuestionAuthoring() {
    const addQuestionButton = document.getElementById('button-add-question');
    const overlay = document.getElementById('question-authoring-dialog-overlay');
    const form = document.getElementById('question-form');
    const textInput = document.getElementById('q-text');
    const shortLabelInput = document.getElementById('q-short-label');
    const tagsInput = document.getElementById('q-tags');
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
    const searchInput = document.getElementById('questions-search-input');

    if (!addQuestionButton || !overlay || !form || !textInput || !curveInput || !maxInput || !midField || !midInput ||
        !minInput || !preview || !previewStack || !saveButton || !cancelButton) {
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

    function openAuthoringModal() {
        resetForm();
        overlay.removeAttribute('inert');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('is-open');
        setTimeout(() => textInput.focus({ preventScroll: true }), 60);
    }

    function closeAuthoringModal() {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('inert', '');
        document.querySelectorAll('#question-authoring-dialog .hold-action').forEach(button => resetHold(button));
        addQuestionButton.focus({ preventScroll: true });
    }

    cancelAuthoringHandler = () => {
        resetForm();
        closeAuthoringModal();
    };

    saveAuthoringHandler = async () => {
        if (saveButton.disabled) return;
        saveButton.disabled = true;
        try {
            const outcome = await createCustomQuestion({
                text: textInput.value,
                shortLabel: shortLabelInput ? shortLabelInput.value : '',
                tags: tagsInput ? tagsInput.value : '',
                curve: curveInput.value,
                minLabel: minInput.value,
                maxLabel: maxInput.value,
                midLabel: midInput.value,
                addToSet: addToSetInput ? addToSetInput.checked : false
            });

            if (addToSetInput && addToSetInput.checked) {
                await loadActiveQuestions();
            }

            await loadQuestionsView();
            resetForm();
            closeAuthoringModal();

            if (outcome.status === 'added') {
                showNoticeDialog(
                    'Question Saved',
                    'Your custom question has been saved and will appear in your check-in tracker.',
                    addQuestionButton
                );
            } else if (outcome.status === 'restored') {
                showNoticeDialog(
                    'Question Restored',
                    'That question already existed in your archived items and has been restored.',
                    addQuestionButton
                );
            } else {
                showNoticeDialog(
                    'Question Exists',
                    'You already have an active question with this text in your library.',
                    addQuestionButton
                );
            }
        } catch (error) {
            console.error('Failed to save question:', error);
            showNoticeDialog(
                'Could Not Save',
                'Could not save the question. Please check the fields and try again.',
                addQuestionButton
            );
            syncSaveEnabled();
        }
    };

    addQuestionButton.addEventListener('click', () => {
        openAuthoringModal();
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
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

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            void loadQuestionsView().catch(error => {
                console.error('Failed to filter questions view:', error);
            });
        });
    }

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelAuthoringHandler();
        }
    });

    syncMidVisibility();
    syncSaveEnabled();
    refreshPreview();
}
