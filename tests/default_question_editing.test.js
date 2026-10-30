// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
    setupTestDOM,
    waitFor,
    navigateToQuestionsCanvas,
    openQuestionAuthoringDialog
} from './test-utils.js';
import { get, getAll } from '../public/js/storage/db.js';
import { seedDefaults, updateCustomQuestion } from '../public/js/questions.js';
import { saveQuestionFromAuthoring, loadQuestionsView } from '../public/js/ui/question-view.js';

describe('Default Question Editing and Wording History Workflow', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;

        await navigateToQuestionsCanvas(windowInstance, documentInstance);
    });

    it('renders an active Edit button on default question cards instead of Copy', async () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const defaultCard = Array.from(activeList.children).find(card => {
            const badge = card.querySelector('.question-card-badge');
            return badge && badge.textContent.trim() === 'Built-in';
        });

        expect(defaultCard).not.toBeNull();
        const copyButton = defaultCard.querySelector('.question-copy-button');
        expect(copyButton).toBeNull();

        const editButton = defaultCard.querySelector('.question-edit-button');
        expect(editButton).not.toBeNull();
        expect(editButton.disabled).toBe(false);
        expect(editButton.textContent.trim()).toBe('Edit');
        expect(editButton.getAttribute('data-action')).toBe('edit-question');
    });

    it('opens authoring dialog pre-filled with default question details and displays wording hint', async () => {
        const overlay = await openQuestionAuthoringDialog(documentInstance, 'q_overall', 'edit');
        expect(overlay.classList.contains('is-open')).toBe(true);

        const modalTitle = documentInstance.getElementById('question-authoring-dialog-title');
        expect(modalTitle.textContent).toBe('Edit Custom Question');

        const textInput = documentInstance.getElementById('q-text');
        expect(textInput.value).toBe('Overall, where does your mood sit right now?');

        const shortLabelInput = documentInstance.getElementById('q-short-label');
        expect(shortLabelInput.value).toBe('Overall Mood');

        const wordingHint = documentInstance.getElementById('question-edit-wording-hint');
        expect(wordingHint).not.toBeNull();
        expect(wordingHint.hidden).toBe(false);
        expect(wordingHint.textContent).toContain(
            'Past answers keep their place on the graph; the graph will mark where the wording changed.'
        );
    });

    it('records wording history and keeps originalText frozen when editing default question text', async () => {
        const overlay = await openQuestionAuthoringDialog(documentInstance, 'q_overall', 'edit');
        const textInput = documentInstance.getElementById('q-text');

        const initialDefault = await get('questions', 'q_overall');
        expect(initialDefault.originalText).toBe('Overall, where does your mood sit right now?');
        expect(initialDefault.textHistory).toBeUndefined();

        textInput.value = 'How would you rate your overall mood state right now?';
        textInput.dispatchEvent(new windowInstance.Event('input'));

        await saveQuestionFromAuthoring();
        await waitFor(() => !overlay.classList.contains('is-open'));

        const updated = await get('questions', 'q_overall');
        expect(updated.id).toBe('q_overall');
        expect(updated.originalText).toBe('Overall, where does your mood sit right now?');
        expect(updated.text).toBe('How would you rate your overall mood state right now?');
        expect(updated.builtIn).toBe(true);
        expect(Array.isArray(updated.textHistory)).toBe(true);
        expect(updated.textHistory.length).toBe(1);
        expect(updated.textHistory[0].text).toBe('How would you rate your overall mood state right now?');
        expect(typeof updated.textHistory[0].changedAt).toBe('string');
    });

    it('does not append to textHistory on a typo-free no-op edit', async () => {
        const initialDefault = await get('questions', 'q_sadness');
        expect(initialDefault.textHistory).toBeUndefined();

        // Perform edit that does not change normalized text (e.g. whitespace or only shortLabel change)
        const updated = await updateCustomQuestion('q_sadness', {
            text: '  How heavy or deep is your sadness right now?  ',
            shortLabel: 'Sadness Depth Custom'
        });

        expect(updated.shortLabel).toBe('Sadness Depth Custom');
        expect(updated.textHistory).toBeUndefined();

        // Perform another edit with exact same text
        const secondUpdated = await updateCustomQuestion('q_sadness', {
            text: 'How heavy or deep is your sadness right now?'
        });
        expect(secondUpdated.textHistory).toBeUndefined();
    });

    it('re-seeding via seedDefaults leaves edited default records alone', async () => {
        // Edit a default question's text and short label
        await updateCustomQuestion('q_energy', {
            text: 'How is your vitality and physical drive today?',
            shortLabel: 'Vitality',
            tags: ['CustomEnergyTag']
        });

        const beforeReSeed = await get('questions', 'q_energy');
        expect(beforeReSeed.text).toBe('How is your vitality and physical drive today?');
        expect(beforeReSeed.shortLabel).toBe('Vitality');
        expect(beforeReSeed.tags).toEqual(['CustomEnergyTag']);

        // Run seedDefaults again (simulate reload or app startup)
        await seedDefaults();

        const afterReSeed = await get('questions', 'q_energy');
        expect(afterReSeed.text).toBe('How is your vitality and physical drive today?');
        expect(afterReSeed.shortLabel).toBe('Vitality');
        expect(afterReSeed.tags).toEqual(['CustomEnergyTag']);
        expect(afterReSeed.originalText).toBe('What is your current energy level?');
        expect(Array.isArray(afterReSeed.textHistory)).toBe(true);
        expect(afterReSeed.textHistory.length).toBe(1);
    });

    it('loads question view cleanly when records lack textHistory', async () => {
        const allQuestions = await getAll('questions');
        const recordsWithoutHistory = allQuestions.filter(question => !question.textHistory);
        expect(recordsWithoutHistory.length).toBeGreaterThan(0);

        // Rendering questions view without textHistory field works with zero exceptions
        await loadQuestionsView();

        const activeList = documentInstance.getElementById('questions-active-list');
        expect(activeList.children.length).toBeGreaterThan(0);
    });
});
