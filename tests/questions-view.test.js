// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import {
    questionMatchesSearch,
    partitionQuestionsForView,
    loadQuestionsView
} from '../public/js/ui/question-authoring.js';
import { executeHoldAction } from '../public/js/ui/hold-actions.js';

describe('Questions View — Search, Layout & Modal (Task 5.4)', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
    });

    it('1. questionMatchesSearch matches text, short label, and tags case-insensitively', () => {
        const sampleQuestion = {
            text: 'How heavy or deep is your sadness right now?',
            shortLabel: 'Sadness Depth',
            tags: ['Mood', 'Affect']
        };

        expect(questionMatchesSearch(sampleQuestion, 'sadness')).toBe(true);
        expect(questionMatchesSearch(sampleQuestion, 'MOOD')).toBe(true);
        expect(questionMatchesSearch(sampleQuestion, 'depth')).toBe(true);
        expect(questionMatchesSearch(sampleQuestion, 'energy')).toBe(false);
        expect(questionMatchesSearch(sampleQuestion, '')).toBe(true);
    });

    it('2. partitionQuestionsForView splits active tracker order from inactive catalog', () => {
        const allQuestions = [
            { id: 'q_energy', text: 'Energy', shortLabel: 'Energy', builtIn: true, archived: false, tags: ['Energy'] },
            { id: 'q_sadness', text: 'Sadness', shortLabel: 'Sadness', builtIn: true, archived: false, tags: ['Mood'] },
            { id: 'q_worth', text: 'Worth', shortLabel: 'Worth', builtIn: true, archived: false, tags: ['Cognitive'] },
            { id: 'c_custom', text: 'Custom', shortLabel: 'Custom', builtIn: false, archived: false, tags: ['Sleep'] }
        ];
        const activeSetIds = ['q_sadness', 'q_energy'];

        const { activeQuestions, catalogQuestions } = partitionQuestionsForView(allQuestions, activeSetIds, '');

        expect(activeQuestions.map(question => question.id)).toEqual(['q_sadness', 'q_energy']);
        expect(catalogQuestions.map(question => question.id)).toEqual(['c_custom', 'q_worth']);
    });

    it('3. Navigating to questions view renders active cards and catalog cards', async () => {
        windowInstance.navigateTo('questions-canvas');
        await waitFor(() => documentInstance.querySelectorAll('.question-card').length >= 7);

        const activeList = documentInstance.getElementById('questions-active-list');
        const catalogList = documentInstance.getElementById('questions-catalog-list');

        expect(activeList.querySelectorAll('.question-card').length).toBe(4);
        expect(catalogList.querySelectorAll('.question-card').length).toBe(7);
        expect(activeList.querySelector('.question-card-badge-builtin')).toBeTruthy();
        expect(activeList.querySelector('.question-tag-chip')).toBeTruthy();
        expect(activeList.textContent).toContain('Energy');
        expect(activeList.innerHTML).not.toContain('&lt;span class="question-tag-chip"');
        expect(activeList.querySelector('.question-drag-handle')).toBeTruthy();
        expect(activeList.querySelector('.question-reorder-button')).toBeTruthy();
        expect(activeList.querySelector('input[role="switch"]')).toBeTruthy();
        expect(catalogList.querySelector('.question-drag-handle')).toBeFalsy();
        expect(catalogList.querySelector('.question-reorder-button')).toBeFalsy();
        expect(catalogList.querySelector('input[role="switch"]')).toBeTruthy();
    });

    it('4. Search input filters both sections in real time', async () => {
        windowInstance.navigateTo('questions-canvas');
        await waitFor(() => documentInstance.querySelectorAll('.question-card').length >= 7);

        const searchInput = documentInstance.getElementById('questions-search-input');
        searchInput.value = 'energy';
        searchInput.dispatchEvent(new windowInstance.Event('input', { bubbles: true }));

        await waitFor(() => {
            const activeCards = documentInstance.getElementById('questions-active-list').querySelectorAll('.question-card');
            return activeCards.length === 1 && activeCards[0].dataset.questionId === 'q_energy';
        });

        const catalogCards = documentInstance.getElementById('questions-catalog-list').querySelectorAll('.question-card');
        expect(catalogCards.length).toBe(1);
        expect(catalogCards[0].dataset.questionId).toBe('q_energy');
        expect(documentInstance.getElementById('questions-catalog-empty').hidden).toBe(true);
    });

    it('5. Add-question FAB opens modal, focuses first field, and closes on Escape with focus return', async () => {
        windowInstance.navigateTo('questions-canvas');
        await loadQuestionsView();

        const addButton = documentInstance.getElementById('button-add-question');
        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        const textInput = documentInstance.getElementById('q-text');

        addButton.click();
        await waitFor(() => overlay.classList.contains('is-open'));

        expect(overlay.getAttribute('aria-hidden')).toBe('false');
        expect(document.activeElement).toBe(textInput);

        overlay.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await waitFor(() => !overlay.classList.contains('is-open'));

        expect(overlay.getAttribute('aria-hidden')).toBe('true');
        expect(document.activeElement).toBe(addButton);
    });

    it('6. Saving a custom question refreshes lists and closes the modal', async () => {
        windowInstance.navigateTo('questions-canvas');
        await loadQuestionsView();

        documentInstance.getElementById('button-add-question').click();
        await waitFor(() => documentInstance.getElementById('question-authoring-dialog-overlay').classList.contains('is-open'));

        documentInstance.getElementById('q-text').value = 'How well did you sleep last night?';
        documentInstance.getElementById('q-text').dispatchEvent(new windowInstance.Event('input', { bubbles: true }));
        documentInstance.getElementById('q-short-label').value = 'Sleep Quality';
        documentInstance.getElementById('q-short-label').dispatchEvent(new windowInstance.Event('input', { bubbles: true }));
        await waitFor(() => !documentInstance.getElementById('button-save-question').disabled);

        executeHoldAction('button-save-question');

        await waitFor(() => {
            const catalogCards = documentInstance.getElementById('questions-catalog-list').querySelectorAll('.question-card');
            return catalogCards.length === 8;
        });

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        expect(overlay.classList.contains('is-open')).toBe(false);
        expect(documentInstance.getElementById('notice-dialog-overlay').classList.contains('is-open')).toBe(true);
    });

    it('7. Restores question cards when questions-canvas is the persisted view on refresh', async () => {
        const setup = await setupTestDOM({ high_and_low_active_view: 'questions-canvas' });
        const restoredDocument = setup.document;

        await waitFor(() => restoredDocument.querySelectorAll('.question-card').length >= 7);

        const questionsCanvas = restoredDocument.getElementById('questions-canvas');
        expect(questionsCanvas.classList.contains('view-active')).toBe(true);
        expect(restoredDocument.getElementById('questions-active-list').querySelectorAll('.question-card').length).toBe(4);
        expect(restoredDocument.getElementById('questions-catalog-list').querySelectorAll('.question-card').length).toBe(7);
    });

    it('8. Active tracker cards reorder the persisted tracker sequence', async () => {
        windowInstance.navigateTo('questions-canvas');
        await waitFor(() => documentInstance.querySelectorAll('#questions-active-list .question-card').length === 4);

        const firstCard = documentInstance.querySelector('#questions-active-list .question-card');
        const firstQuestionId = firstCard.dataset.questionId;
        firstCard.querySelector('[data-question-action="move-down"]').click();

        await waitFor(async () => {
            const activeSetIds = await windowInstance.getConfig('activeQuestionSet');
            return activeSetIds[1] === firstQuestionId;
        });

        const renderedIds = [...documentInstance.querySelectorAll('#questions-active-list .question-card')]
            .map(card => card.dataset.questionId);
        expect(renderedIds[1]).toBe(firstQuestionId);
        expect(windowInstance.STATE.activeQuestions[1].id).toBe(firstQuestionId);
    });

    it('9. In Tracker switch removes an active question into the catalog', async () => {
        windowInstance.navigateTo('questions-canvas');
        await waitFor(() => documentInstance.querySelectorAll('#questions-active-list .question-card').length === 4);

        const activeCard = documentInstance.querySelector('#questions-active-list .question-card');
        const questionId = activeCard.dataset.questionId;
        const trackerToggle = activeCard.querySelector('input[role="switch"]');
        trackerToggle.checked = false;
        trackerToggle.dispatchEvent(new windowInstance.Event('change', { bubbles: true }));

        await waitFor(async () => {
            const activeSetIds = await windowInstance.getConfig('activeQuestionSet');
            return !activeSetIds.includes(questionId);
        });

        const catalogCard = documentInstance.querySelector(
            `#questions-catalog-list [data-question-id="${questionId}"]`
        );
        expect(catalogCard).toBeTruthy();
        expect(windowInstance.STATE.activeQuestions.some(question => question.id === questionId)).toBe(false);
    });

    it('10. Catalog switches add inactive questions to the tracker', async () => {
        windowInstance.navigateTo('questions-canvas');
        await waitFor(() => documentInstance.querySelectorAll('#questions-catalog-list .question-card').length === 7);

        const inactiveCard = [...documentInstance.querySelectorAll('#questions-catalog-list .question-card')]
            .find(card => !card.querySelector('input[role="switch"]').checked);
        const questionId = inactiveCard.dataset.questionId;
        const trackerToggle = inactiveCard.querySelector('input[role="switch"]');
        trackerToggle.checked = true;
        trackerToggle.dispatchEvent(new windowInstance.Event('change', { bubbles: true }));

        await waitFor(async () => {
            const activeSetIds = await windowInstance.getConfig('activeQuestionSet');
            return activeSetIds.includes(questionId);
        });

        expect(windowInstance.STATE.activeQuestions.some(question => question.id === questionId)).toBe(true);
    });
});
