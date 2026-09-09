/**
 * HIGH & LOW - QUESTION AUTHORING UI
 * Questions catalog view, search, read-only cards, and custom question modal authoring.
 */

import {
    normalizeQuestionText,
    createCustomQuestion,
    updateCustomQuestion,
    archiveQuestion,
    restoreQuestion,
    loadActiveQuestions,
    moveActiveQuestion,
    reorderActiveQuestions,
    removeQuestionFromTracker,
    addQuestionToTracker
} from '../questions.js';
import { getAll, getConfig } from '../storage/db.js';
import { buildScoreButtonsHTML, renderCurrentQuestion } from '../checkin.js';
import { showNoticeDialog } from './dialogs.js';
import { resetHold } from './hold-actions.js';
import { escapeHTML, html, rawHTML } from '../utils.js';

let cancelAuthoringHandler = null;
let saveAuthoringHandler = null;
let archiveAuthoringHandler = null;
let isRemovedQuestionsExpanded = false;

export function setRemovedQuestionsExpanded(expanded) {
    isRemovedQuestionsExpanded = Boolean(expanded);
}

export function isRemovedQuestionsSectionExpanded() {
    return isRemovedQuestionsExpanded;
}

export function cancelQuestionAuthoring() {
    if (cancelAuthoringHandler) cancelAuthoringHandler();
}

export async function saveQuestionFromAuthoring() {
    if (saveAuthoringHandler) await saveAuthoringHandler();
}

export async function archiveQuestionFromAuthoring() {
    if (archiveAuthoringHandler) await archiveAuthoringHandler();
}

export const removeQuestionFromAuthoring = archiveQuestionFromAuthoring;

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
    const questionsById = new Map(allQuestions.map(question => [question.id, question]));

    const activeQuestions = (Array.isArray(activeSetIds) ? activeSetIds : [])
        .map(id => questionsById.get(id))
        .filter(question => question && !question.archived && questionMatchesSearch(question, searchQuery));

    const catalogQuestions = allQuestions
        .filter(question => !question.archived && questionMatchesSearch(question, searchQuery))
        .sort((left, right) => {
            const leftLabel = (left.shortLabel || left.text || '').toLowerCase();
            const rightLabel = (right.shortLabel || right.text || '').toLowerCase();
            return leftLabel.localeCompare(rightLabel);
        });

    const archivedQuestions = allQuestions
        .filter(question => question.archived && questionMatchesSearch(question, searchQuery))
        .sort((left, right) => {
            const leftLabel = (left.shortLabel || left.text || '').toLowerCase();
            const rightLabel = (right.shortLabel || right.text || '').toLowerCase();
            return leftLabel.localeCompare(rightLabel);
        });

    return { activeQuestions, catalogQuestions, archivedQuestions };
}

export function buildQuestionCardHTML(question, options = {}) {
    const parsedOptions = typeof options === 'boolean'
        ? { isActiveInTracker: options, isReorderable: false, isArchived: false, questionIndex: 0, totalQuestionsCount: 1 }
        : options;

    const isArchived = Boolean(parsedOptions.isArchived || question.archived);
    const isActiveInTracker = isArchived ? false : Boolean(parsedOptions.isActiveInTracker);
    const isReorderable = isArchived ? false : Boolean(parsedOptions.isReorderable);
    const questionIndex = typeof parsedOptions.questionIndex === 'number'
        ? parsedOptions.questionIndex
        : 0;
    const totalQuestionsCount = typeof parsedOptions.totalQuestionsCount === 'number'
        ? parsedOptions.totalQuestionsCount
        : 1;

    let statusLabel = question.builtIn ? 'Built-in' : 'Custom';
    let statusClass = question.builtIn ? 'question-card-badge-builtin' : 'question-card-badge-custom';
    if (isArchived) {
        statusLabel = 'Archived';
        statusClass = 'question-card-badge-archived';
    }

    const tags = Array.isArray(question.tags) ? question.tags : [];
    const tagChipsHTML = tags
        .map(tag => `<span class="question-tag-chip">${escapeHTML(tag)}</span>`)
        .join('');
    const tagsHTML = tags.length > 0
        ? `<div class="question-card-tags" aria-label="Tags">${tagChipsHTML}</div>`
        : '';
    const shortLabelHTML = question.shortLabel
        ? `<p class="question-card-short-label">${escapeHTML(question.shortLabel)}</p>`
        : '';
    const questionTitle = escapeHTML(question.shortLabel || question.text);

    const toggleAction = isActiveInTracker ? 'remove-from-tracker' : 'add-to-tracker';
    const toggleChecked = isActiveInTracker ? 'true' : 'false';
    const toggleActiveClass = isActiveInTracker ? ' is-active' : '';
    const toggleAriaLabel = isActiveInTracker
        ? `In tracker: ${questionTitle}. Toggle to remove from tracker.`
        : `Not in tracker: ${questionTitle}. Toggle to add to tracker.`;

    const isFirstQuestion = questionIndex === 0;
    const isLastQuestion = questionIndex === totalQuestionsCount - 1;

    let cardModifierClass = 'question-card-catalog';
    if (isArchived) {
        cardModifierClass = 'question-card-archived';
    } else if (isReorderable) {
        cardModifierClass = 'question-card-active is-reorderable';
    }

    const cardClasses = [
        'question-card',
        cardModifierClass
    ].join(' ');

    const indexAttribute = isReorderable ? ` data-index="${questionIndex}"` : '';

    const toggleHTML = isArchived
        ? ''
        : `<button type="button" role="switch" aria-checked="${toggleChecked}" class="question-tracker-toggle question-catalog-toggle card-action-toggle${toggleActiveClass}" data-action="${toggleAction}" data-question-id="${question.id}" aria-label="${toggleAriaLabel}">
            <span class="toggle-track" aria-hidden="true">
                <span class="toggle-thumb"></span>
            </span>
        </button>`;

    const isBuiltIn = Boolean(question.builtIn);
    let actionButtonsHTML = '';
    if (isArchived) {
        actionButtonsHTML = `<button type="button" class="question-restore-button card-action-restore" data-action="restore-question" data-question-id="${question.id}" aria-label="Restore question: ${questionTitle}">
            Restore
        </button>`;
    } else {
        actionButtonsHTML = `<button type="button" class="question-edit-button card-action-edit" data-action="edit-question" data-question-id="${question.id}" aria-label="Edit question: ${questionTitle}"${isBuiltIn ? ' disabled' : ''}>
            Edit
        </button>`;
        if (!isBuiltIn) {
            actionButtonsHTML += ` <button type="button" class="question-archive-button question-remove-button card-action-archive card-action-remove" data-action="archive-question" data-question-id="${question.id}" aria-label="Remove question: ${questionTitle}">
                Remove
            </button>`;
        }
    }

    return html`
        <li class="${cardClasses}" data-question-id="${question.id}"${rawHTML(indexAttribute)}>
            <div class="question-card-header">
                <p class="question-card-text">${question.text}</p>
                <div class="question-card-status-group">
                    <span class="question-card-badge ${statusClass}">${statusLabel}</span>
                    ${rawHTML(toggleHTML)}
                </div>
            </div>
            ${rawHTML(shortLabelHTML)}
            ${rawHTML(tagsHTML)}
            <div class="card-action-row question-card-actions">
                <div class="card-actions-non-dominant">
                    ${rawHTML(actionButtonsHTML)}
                </div>
                <div class="card-actions-center">
                    <div class="question-reorder-controls" role="group" aria-label="Reorder question in tracker sequence">
                        <button type="button" class="question-reorder-button question-reorder-up" data-action="move-up" data-question-id="${question.id}" aria-label="Move '${questionTitle}' up in tracker"${isFirstQuestion ? ' disabled' : ''}>
                            <span aria-hidden="true">&uarr;</span>
                            <span class="reorder-label sr-only">Move up</span>
                        </button>
                        <button type="button" class="question-drag-handle" draggable="true" data-question-id="${question.id}" aria-label="Drag to reorder '${questionTitle}'. Use arrow keys or drag." aria-grabbed="false">
                            <span class="drag-handle-bar" aria-hidden="true">
                                <span class="drag-handle-line"></span>
                                <span class="drag-handle-line"></span>
                            </span>
                        </button>
                        <button type="button" class="question-reorder-button question-reorder-down" data-action="move-down" data-question-id="${question.id}" aria-label="Move '${questionTitle}' down in tracker"${isLastQuestion ? ' disabled' : ''}>
                            <span aria-hidden="true">&darr;</span>
                            <span class="reorder-label sr-only">Move down</span>
                        </button>
                    </div>
                </div>
                <div class="card-actions-dominant"></div>
            </div>
        </li>
    `;
}

export function buildActiveQuestionCardHTML(question, questionIndex, totalQuestionsCount) {
    return buildQuestionCardHTML(question, {
        isActiveInTracker: true,
        isReorderable: true,
        questionIndex,
        totalQuestionsCount
    });
}

export function setupActiveQuestionsListeners(activeList) {
    if (!activeList || activeList.dataset.hasActiveListeners === 'true') return;
    activeList.dataset.hasActiveListeners = 'true';

    let pointerDragState = null;

    const clearDragClasses = () => {
        activeList.querySelectorAll('.question-card-active').forEach(card => {
            card.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom');
            const handle = card.querySelector('.question-drag-handle');
            if (handle) {
                handle.classList.remove('is-grabbing');
                handle.setAttribute('aria-grabbed', 'false');
            }
        });
    };

    activeList.addEventListener('click', async (event) => {
        const editButton = event.target.closest('.question-edit-button');
        if (editButton && !editButton.disabled) {
            event.preventDefault();
            const questionId = editButton.getAttribute('data-question-id');
            const customEvent = new CustomEvent('question-edit-requested', {
                bubbles: true,
                detail: { questionId }
            });
            editButton.dispatchEvent(customEvent);
            return;
        }

        const archiveButton = event.target.closest('.question-archive-button, .question-remove-button');
        if (archiveButton) {
            event.preventDefault();
            const questionId = archiveButton.getAttribute('data-question-id');
            if (questionId) {
                await archiveQuestion(questionId);
                isRemovedQuestionsExpanded = true;
                await loadActiveQuestions();
                await loadQuestionsView();
                renderCurrentQuestion();
                showNoticeDialog('Question Removed', 'This question has been removed.', archiveButton);
            }
            return;
        }

        const reorderButton = event.target.closest('.question-reorder-button');
        if (reorderButton && !reorderButton.disabled) {
            event.preventDefault();
            const action = reorderButton.getAttribute('data-action');
            const questionId = reorderButton.getAttribute('data-question-id');
            if (questionId && (action === 'move-up' || action === 'move-down')) {
                const direction = action === 'move-up' ? 'up' : 'down';
                const hasMoved = await moveActiveQuestion(questionId, direction);
                if (hasMoved) {
                    await loadQuestionsView();
                    const nextButton = activeList.querySelector(`button[data-question-id="${questionId}"][data-action="${action}"]`);
                    if (nextButton && !nextButton.disabled) {
                        nextButton.focus();
                    } else {
                        const oppositeAction = action === 'move-up' ? 'move-down' : 'move-up';
                        const fallbackButton = activeList.querySelector(`button[data-question-id="${questionId}"][data-action="${oppositeAction}"]`);
                        if (fallbackButton) fallbackButton.focus();
                    }
                }
            }
            return;
        }

        const toggleButton = event.target.closest('.question-tracker-toggle');
        if (toggleButton) {
            event.preventDefault();
            const questionId = toggleButton.getAttribute('data-question-id');
            if (questionId) {
                await removeQuestionFromTracker(questionId);
                await loadQuestionsView();
            }
            return;
        }
    });

    // Keyboard reordering on the drag handle
    activeList.addEventListener('keydown', async (event) => {
        const dragHandle = event.target.closest('.question-drag-handle');
        if (!dragHandle) return;

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const questionId = dragHandle.getAttribute('data-question-id');
            const direction = event.key === 'ArrowUp' ? 'up' : 'down';
            const hasMoved = await moveActiveQuestion(questionId, direction);
            if (hasMoved) {
                await loadQuestionsView();
                const nextHandle = activeList.querySelector(`.question-drag-handle[data-question-id="${questionId}"]`);
                if (nextHandle) nextHandle.focus();
            }
        }
    });

    // HTML5 Drag and Drop Events
    activeList.addEventListener('dragstart', (event) => {
        const dragHandle = event.target.closest('.question-drag-handle');
        const sourceCard = event.target.closest('.question-card-active');
        if (!sourceCard) return;

        const questionId = sourceCard.getAttribute('data-question-id');
        if (!questionId) return;

        if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', questionId);
            event.dataTransfer.effectAllowed = 'move';
        }

        sourceCard.classList.add('is-dragging');
        if (dragHandle) {
            dragHandle.classList.add('is-grabbing');
            dragHandle.setAttribute('aria-grabbed', 'true');
        }

        if (event.dataTransfer && typeof event.dataTransfer.setDragImage === 'function') {
            const cardBoundingRect = sourceCard.getBoundingClientRect();
            const pointerOffsetX = event.clientX - cardBoundingRect.left;
            const pointerOffsetY = event.clientY - cardBoundingRect.top;
            event.dataTransfer.setDragImage(
                sourceCard,
                Number.isFinite(pointerOffsetX) ? pointerOffsetX : (cardBoundingRect.width / 2),
                Number.isFinite(pointerOffsetY) ? pointerOffsetY : (cardBoundingRect.height - 20)
            );
        }
    });

    activeList.addEventListener('dragover', (event) => {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }

        const targetCard = event.target.closest('.question-card-active:not(.is-dragging)');
        if (!targetCard) return;

        const rect = targetCard.getBoundingClientRect();
        const isAbove = event.clientY < (rect.top + rect.height / 2);

        activeList.querySelectorAll('.question-card-active').forEach(card => {
            if (card !== targetCard) {
                card.classList.remove('drag-over-top', 'drag-over-bottom');
            }
        });

        if (isAbove) {
            targetCard.classList.add('drag-over-top');
            targetCard.classList.remove('drag-over-bottom');
        } else {
            targetCard.classList.add('drag-over-bottom');
            targetCard.classList.remove('drag-over-top');
        }
    });

    activeList.addEventListener('dragleave', (event) => {
        const relatedTarget = event.relatedTarget;
        if (!relatedTarget || !activeList.contains(relatedTarget)) {
            activeList.querySelectorAll('.question-card-active').forEach(card => {
                card.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        }
    });

    activeList.addEventListener('drop', async (event) => {
        event.preventDefault();
        const draggedQuestionId = event.dataTransfer ? event.dataTransfer.getData('text/plain') : null;
        const targetCard = event.target.closest('.question-card-active');

        clearDragClasses();

        if (!draggedQuestionId || !targetCard) return;
        const targetQuestionId = targetCard.getAttribute('data-question-id');
        if (draggedQuestionId === targetQuestionId) return;

        const rect = targetCard.getBoundingClientRect();
        const isAbove = event.clientY < (rect.top + rect.height / 2);

        const currentCards = Array.from(activeList.querySelectorAll('.question-card-active'));
        const currentIds = currentCards.map(card => card.getAttribute('data-question-id'));
        const sourceIndex = currentIds.indexOf(draggedQuestionId);
        let targetIndex = currentIds.indexOf(targetQuestionId);

        if (sourceIndex === -1 || targetIndex === -1) return;

        currentIds.splice(sourceIndex, 1);
        if (!isAbove) {
            targetIndex = currentIds.indexOf(targetQuestionId) + 1;
        } else {
            targetIndex = currentIds.indexOf(targetQuestionId);
        }
        currentIds.splice(targetIndex, 0, draggedQuestionId);

        await reorderActiveQuestions(currentIds);
        await loadQuestionsView();
    });

    activeList.addEventListener('dragend', () => {
        clearDragClasses();
    });

    // Pointer / Touch Events for Smooth Mobile Dragging
    activeList.addEventListener('pointerdown', (event) => {
        const dragHandle = event.target.closest('.question-drag-handle');
        if (!dragHandle) return;
        const sourceCard = dragHandle.closest('.question-card-active');
        if (!sourceCard) return;

        const questionId = dragHandle.getAttribute('data-question-id');
        if (!questionId) return;

        if (event.button !== 0 && event.pointerType === 'mouse') return;

        try {
            dragHandle.setPointerCapture(event.pointerId);
        } catch {
            // In case pointer capture is unsupported
        }

        dragHandle.classList.add('is-grabbing');
        dragHandle.setAttribute('aria-grabbed', 'true');
        sourceCard.classList.add('is-dragging');

        pointerDragState = {
            pointerId: event.pointerId,
            questionId,
            sourceCard,
            dragHandle,
            currentOverCard: null,
            isAbove: false
        };
    });

    activeList.addEventListener('pointermove', (event) => {
        if (!pointerDragState || pointerDragState.pointerId !== event.pointerId) return;

        const elementsUnderPointer = typeof document.elementsFromPoint === 'function'
            ? document.elementsFromPoint(event.clientX, event.clientY)
            : [];
        const targetCard = elementsUnderPointer.find(element =>
            element.classList?.contains('question-card-active') && element !== pointerDragState.sourceCard
        );

        activeList.querySelectorAll('.question-card-active').forEach(card => {
            if (card !== targetCard) {
                card.classList.remove('drag-over-top', 'drag-over-bottom');
            }
        });

        if (targetCard) {
            const rect = targetCard.getBoundingClientRect();
            const isAbove = event.clientY < (rect.top + rect.height / 2);
            pointerDragState.currentOverCard = targetCard;
            pointerDragState.isAbove = isAbove;

            if (isAbove) {
                targetCard.classList.add('drag-over-top');
                targetCard.classList.remove('drag-over-bottom');
            } else {
                targetCard.classList.add('drag-over-bottom');
                targetCard.classList.remove('drag-over-top');
            }
        } else {
            pointerDragState.currentOverCard = null;
        }
    });

    const finishPointerDrag = async (event) => {
        if (!pointerDragState || pointerDragState.pointerId !== event.pointerId) return;
        const { questionId, dragHandle, currentOverCard, isAbove } = pointerDragState;
        pointerDragState = null;

        try {
            dragHandle.releasePointerCapture(event.pointerId);
        } catch {
            // Pointer capture release
        }

        clearDragClasses();

        if (currentOverCard) {
            const targetQuestionId = currentOverCard.getAttribute('data-question-id');
            if (targetQuestionId && targetQuestionId !== questionId) {
                const currentCards = Array.from(activeList.querySelectorAll('.question-card-active'));
                const currentIds = currentCards.map(card => card.getAttribute('data-question-id'));
                const sourceIndex = currentIds.indexOf(questionId);
                if (sourceIndex !== -1) {
                    currentIds.splice(sourceIndex, 1);
                    let targetIndex = currentIds.indexOf(targetQuestionId);
                    if (targetIndex !== -1) {
                        if (!isAbove) {
                            targetIndex += 1;
                        }
                        currentIds.splice(targetIndex, 0, questionId);
                        await reorderActiveQuestions(currentIds);
                        await loadQuestionsView();
                    }
                }
            }
        }
    };

    activeList.addEventListener('pointerup', finishPointerDrag);
    activeList.addEventListener('pointercancel', finishPointerDrag);
}

export function setupCatalogQuestionsListeners(catalogList) {
    if (!catalogList || catalogList.dataset.hasCatalogListeners === 'true') return;
    catalogList.dataset.hasCatalogListeners = 'true';

    catalogList.addEventListener('click', async (event) => {
        const editButton = event.target.closest('.question-edit-button');
        if (editButton && !editButton.disabled) {
            event.preventDefault();
            const questionId = editButton.getAttribute('data-question-id');
            const customEvent = new CustomEvent('question-edit-requested', {
                bubbles: true,
                detail: { questionId }
            });
            editButton.dispatchEvent(customEvent);
            return;
        }

        const archiveButton = event.target.closest('.question-archive-button, .question-remove-button');
        if (archiveButton) {
            event.preventDefault();
            const questionId = archiveButton.getAttribute('data-question-id');
            if (questionId) {
                await archiveQuestion(questionId);
                isRemovedQuestionsExpanded = true;
                await loadActiveQuestions();
                await loadQuestionsView();
                renderCurrentQuestion();
                showNoticeDialog('Question Removed', 'This question has been removed.', archiveButton);
            }
            return;
        }

        const toggleButton = event.target.closest('.question-tracker-toggle');
        if (toggleButton) {
            event.preventDefault();
            const action = toggleButton.getAttribute('data-action');
            const questionId = toggleButton.getAttribute('data-question-id');
            if (questionId) {
                if (action === 'remove-from-tracker') {
                    await removeQuestionFromTracker(questionId);
                } else {
                    await addQuestionToTracker(questionId);
                }
                await loadQuestionsView();
            }
            return;
        }
    });
}

export function setupArchivedQuestionsListeners(archivedList) {
    if (!archivedList || archivedList.dataset.hasArchivedListeners === 'true') return;
    archivedList.dataset.hasArchivedListeners = 'true';

    archivedList.addEventListener('click', async (event) => {
        const restoreButton = event.target.closest('.question-restore-button, [data-action="restore-question"]');
        if (restoreButton) {
            event.preventDefault();
            const questionId = restoreButton.getAttribute('data-question-id');
            if (questionId) {
                await restoreQuestion(questionId);
                await loadQuestionsView();
                showNoticeDialog('Question Restored', 'The question has been restored to your question catalog.', restoreButton);
            }
            return;
        }

        const editButton = event.target.closest('.question-edit-button');
        if (editButton) {
            event.preventDefault();
            const questionId = editButton.getAttribute('data-question-id');
            const customEvent = new CustomEvent('question-edit-requested', {
                bubbles: true,
                detail: { questionId }
            });
            editButton.dispatchEvent(customEvent);
            return;
        }
    });
}

export function setupRemovedQuestionsToggleListener(toggleRemovedButton) {
    if (!toggleRemovedButton || toggleRemovedButton.dataset.hasToggleListener === 'true') return;
    toggleRemovedButton.dataset.hasToggleListener = 'true';

    toggleRemovedButton.addEventListener('click', async (event) => {
        event.preventDefault();
        isRemovedQuestionsExpanded = !isRemovedQuestionsExpanded;
        await loadQuestionsView();
    });
}

export async function loadQuestionsView() {
    const activeList = document.getElementById('questions-active-list');
    const catalogList = document.getElementById('questions-catalog-list');
    const archivedList = document.getElementById('questions-archived-list');
    const activeEmpty = document.getElementById('questions-active-empty');
    const catalogEmpty = document.getElementById('questions-catalog-empty');
    const archivedEmpty = document.getElementById('questions-archived-empty');
    const archivedSection = document.getElementById('questions-archived-section') ||
        document.getElementById('questions-removed-section');
    const archivedDivider = document.getElementById('questions-archived-divider');
    const toggleRemovedButton = document.getElementById('button-toggle-removed-questions');
    const searchInput = document.getElementById('questions-search-input');

    if (!activeList || !catalogList) return;

    setupActiveQuestionsListeners(activeList);
    setupCatalogQuestionsListeners(catalogList);
    if (toggleRemovedButton) {
        setupRemovedQuestionsToggleListener(toggleRemovedButton);
    }
    if (archivedList) {
        setupArchivedQuestionsListeners(archivedList);
    }

    const searchQuery = searchInput ? searchInput.value : '';
    const [allQuestions, activeSetIds] = await Promise.all([
        getAll('questions'),
        getConfig('activeQuestionSet')
    ]);

    const { activeQuestions, catalogQuestions, archivedQuestions } = partitionQuestionsForView(
        allQuestions,
        activeSetIds,
        searchQuery
    );

    const activeIdSet = new Set(Array.isArray(activeSetIds) ? activeSetIds : []);

    activeList.innerHTML = activeQuestions
        .map((question, questionIndex) => buildActiveQuestionCardHTML(
            question,
            questionIndex,
            activeQuestions.length
        ))
        .join('');
    catalogList.innerHTML = catalogQuestions
        .map(question => buildQuestionCardHTML(question, {
            isActiveInTracker: activeIdSet.has(question.id),
            isReorderable: false
        }))
        .join('');

    if (activeEmpty) activeEmpty.hidden = activeQuestions.length > 0;
    if (catalogEmpty) catalogEmpty.hidden = catalogQuestions.length > 0;

    const totalArchivedCount = allQuestions.filter(question => question.archived).length;
    if (totalArchivedCount === 0) {
        isRemovedQuestionsExpanded = false;
    }

    if (toggleRemovedButton) {
        toggleRemovedButton.hidden = totalArchivedCount === 0;
        toggleRemovedButton.setAttribute('aria-expanded', isRemovedQuestionsExpanded ? 'true' : 'false');
        toggleRemovedButton.textContent = isRemovedQuestionsExpanded
            ? 'Hide Removed Questions'
            : 'Show Removed Questions';
    }

    if (archivedDivider) {
        archivedDivider.hidden = true;
    }

    const isShowingRemoved = isRemovedQuestionsExpanded && totalArchivedCount > 0;

    if (archivedSection) {
        archivedSection.hidden = !isShowingRemoved;
    }

    if (archivedList) {
        if (isShowingRemoved) {
            archivedList.innerHTML = archivedQuestions
                .map(question => buildQuestionCardHTML(question, {
                    isArchived: true,
                    isActiveInTracker: false,
                    isReorderable: false
                }))
                .join('');

            if (archivedEmpty) {
                archivedEmpty.hidden = archivedQuestions.length > 0;
                archivedEmpty.textContent = 'No removed questions match your search.';
            }
        } else {
            archivedList.innerHTML = '';
            if (archivedEmpty) {
                archivedEmpty.hidden = true;
            }
        }
    }
}

export function setupQuestionAuthoring() {
    let currentEditingQuestionId = null;

    const addQuestionButton = document.getElementById('button-add-question');
    const overlay = document.getElementById('question-authoring-dialog-overlay');
    const modalTitle = document.getElementById('question-authoring-dialog-title');
    const modalSubtitle = document.getElementById('question-authoring-dialog-subtitle');
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
    const addToSetLabel = document.getElementById('q-add-to-set-label');
    const saveButton = document.getElementById('button-save-question');
    const cancelButton = document.getElementById('button-cancel-question');
    const archiveRow = document.getElementById('archive-question-row');
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
        currentEditingQuestionId = null;
        resetForm();

        if (modalTitle) modalTitle.textContent = 'Add Custom Question';
        if (modalSubtitle) modalSubtitle.textContent = 'Create a new question for your library and optional daily tracker.';
        const saveButtonLabel = saveButton.querySelector('.button-label');
        if (saveButtonLabel) saveButtonLabel.textContent = 'Save Question';
        if (archiveRow) archiveRow.hidden = true;
        if (addToSetLabel) addToSetLabel.textContent = 'Add to my daily set now';

        overlay.removeAttribute('inert');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('is-open');
        setTimeout(() => textInput.focus({ preventScroll: true }), 60);
    }

    async function openEditModal(question) {
        currentEditingQuestionId = question.id;
        resetForm();

        if (modalTitle) modalTitle.textContent = 'Edit Custom Question';
        if (modalSubtitle) modalSubtitle.textContent = 'Update question details or remove this question.';
        const saveButtonLabel = saveButton.querySelector('.button-label');
        if (saveButtonLabel) saveButtonLabel.textContent = 'Save Changes';
        if (archiveRow) archiveRow.hidden = false;
        const removeButtonLabel = archiveRow?.querySelector('.button-label');
        if (removeButtonLabel) removeButtonLabel.textContent = 'Remove Question';
        if (addToSetLabel) addToSetLabel.textContent = 'Active in daily tracker';

        textInput.value = question.text;
        if (shortLabelInput) shortLabelInput.value = question.shortLabel || '';
        if (tagsInput) tagsInput.value = Array.isArray(question.tags) ? question.tags.join(', ') : '';
        curveInput.value = question.curve || 'more-is-better';
        maxInput.value = question.maxLabel || '';
        midInput.value = question.midLabel || '';
        minInput.value = question.minLabel || '';

        const activeSet = await getConfig('activeQuestionSet');
        if (addToSetInput) {
            addToSetInput.checked = Array.isArray(activeSet) && activeSet.includes(question.id);
        }

        syncMidVisibility();
        syncSaveEnabled();
        refreshPreview();

        overlay.removeAttribute('inert');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('is-open');
        setTimeout(() => textInput.focus({ preventScroll: true }), 60);
    }

    function closeAuthoringModal() {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('inert', '');
        document.querySelectorAll('#question-authoring-dialog .hold-action').forEach((button) => {
            resetHold(button);
        });
        currentEditingQuestionId = null;
        if (archiveRow) archiveRow.hidden = true;
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
            if (currentEditingQuestionId) {
                const questionId = currentEditingQuestionId;
                await updateCustomQuestion(questionId, {
                    text: textInput.value,
                    shortLabel: shortLabelInput ? shortLabelInput.value : '',
                    tags: tagsInput ? tagsInput.value : '',
                    curve: curveInput.value,
                    minLabel: minInput.value,
                    maxLabel: maxInput.value,
                    midLabel: midInput.value
                });

                if (addToSetInput) {
                    if (addToSetInput.checked) {
                        await addQuestionToTracker(questionId);
                    } else {
                        await removeQuestionFromTracker(questionId);
                    }
                }

                await loadActiveQuestions();
                await loadQuestionsView();
                renderCurrentQuestion();
                resetForm();
                closeAuthoringModal();

                showNoticeDialog(
                    'Question Updated',
                    'Your changes have been saved to this question.',
                    addQuestionButton
                );
            } else {
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

                if (addToSetInput?.checked) {
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
            }
        } catch (error) {
            console.error('Failed to save question:', error);
            showNoticeDialog(
                'Could Not Save',
                error?.message || 'Could not save the question. Please check the fields and try again.',
                addQuestionButton
            );
            syncSaveEnabled();
        }
    };

    archiveAuthoringHandler = async () => {
        if (!currentEditingQuestionId) return;
        try {
            const questionId = currentEditingQuestionId;
            await archiveQuestion(questionId);
            isRemovedQuestionsExpanded = true;
            await loadActiveQuestions();
            await loadQuestionsView();
            renderCurrentQuestion();
            resetForm();
            closeAuthoringModal();

            showNoticeDialog(
                'Question Removed',
                'This question has been removed from your active tracker.',
                addQuestionButton
            );
        } catch (error) {
            console.error('Failed to remove question:', error);
            showNoticeDialog(
                'Could Not Remove',
                error?.message || 'Could not remove the question.',
                addQuestionButton
            );
        }
    };

    document.addEventListener('question-edit-requested', async (event) => {
        const questionId = event.detail?.questionId;
        if (!questionId) return;

        const allQuestions = await getAll('questions');
        const question = allQuestions.find(q => q.id === questionId);
        if (!question) return;

        if (question.builtIn) {
            showNoticeDialog(
                'Built-in Question',
                'Built-in questions are part of the core tracker and cannot be edited or removed.',
                event.target
            );
            return;
        }

        await openEditModal(question);
    });

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

if (typeof window !== 'undefined') {
    window.cancelQuestionAuthoring = cancelQuestionAuthoring;
    window.saveQuestionFromAuthoring = saveQuestionFromAuthoring;
    window.archiveQuestionFromAuthoring = archiveQuestionFromAuthoring;
    window.removeQuestionFromAuthoring = archiveQuestionFromAuthoring;
    window.setRemovedQuestionsExpanded = setRemovedQuestionsExpanded;
    window.isRemovedQuestionsSectionExpanded = isRemovedQuestionsSectionExpanded;
}
