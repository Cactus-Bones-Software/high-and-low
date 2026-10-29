// noinspection JSObjectNullOrUndefined

import { beforeEach, describe, expect, it } from 'vitest';
import {
    navigateToQuestionsCanvas,
    openQuestionAuthoringDialog,
    setupTestDOM,
    waitFor
} from './test-utils.js';
import { createCustomQuestion } from '../public/js/questions.js';
import { saveQuestionFromAuthoring } from '../public/js/ui/question-view.js';
import { get, getAll } from '../public/js/storage/db.js';

describe('Yes/No Question Type — Authoring Dialog Field Tests', () => {
    let windowInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
    });

    it('renders response type selector matching form field conventions in markup', () => {
        const document = windowInstance.document;
        const selector = document.getElementById('q-response-type');
        expect(selector).toBeTruthy();
        expect(selector.tagName.toLowerCase()).toBe('select');

        const label = document.querySelector('label[for="q-response-type"]');
        expect(label).toBeTruthy();
        expect(label.textContent).toContain('Response type');
        expect(label.querySelector('.required-marker')).toBeTruthy();

        const options = Array.from(selector.querySelectorAll('option'));
        expect(options.length).toBe(2);
        expect(options[0].value).toBe('scale');
        expect(options[0].textContent).toBe('5-Point Scale');
        expect(options[1].value).toBe('boolean');
        expect(options[1].textContent).toBe('Yes/No');
        expect(selector.value).toBe('scale');
    });

    it('hides scale-only fields when selecting Yes/No and shows them when selecting 5-Point Scale', async () => {
        const document = windowInstance.document;
        const addQuestionButton = document.getElementById('button-add-question');
        expect(addQuestionButton).toBeTruthy();
        addQuestionButton.click();

        const responseTypeSelector = document.getElementById('q-response-type');
        const scaleFieldsContainer = document.getElementById('scale-only-fields');
        const curveField = document.getElementById('field-curve');
        const maxLabelField = document.getElementById('field-max-label');
        const minLabelField = document.getElementById('field-min-label');
        const scaleHint = document.getElementById('field-scale-hint');

        const expectScaleFieldsVisible = (isVisible) => {
            const expectedHidden = !isVisible;
            expect(scaleFieldsContainer.hidden).toBe(expectedHidden);
            expect(curveField.hidden).toBe(expectedHidden);
            expect(maxLabelField.hidden).toBe(expectedHidden);
            expect(minLabelField.hidden).toBe(expectedHidden);
            expect(scaleHint.hidden).toBe(expectedHidden);
        };

        expect(responseTypeSelector.value).toBe('scale');
        expectScaleFieldsVisible(true);

        // Switch to boolean (Yes/No)
        responseTypeSelector.value = 'boolean';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));
        expectScaleFieldsVisible(false);

        // Switch back to 5-Point Scale
        responseTypeSelector.value = 'scale';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));
        expectScaleFieldsVisible(true);
    });

    it('reflects selected response type in live preview', async () => {
        const document = windowInstance.document;
        const addQuestionButton = document.getElementById('button-add-question');
        addQuestionButton.click();

        const responseTypeSelector = document.getElementById('q-response-type');
        const previewElement = document.getElementById('question-preview');
        const previewStack = document.getElementById('question-preview-stack');

        // Initially in scale mode
        expect(previewElement.getAttribute('data-response-type')).toBe('scale');
        expect(previewElement.getAttribute('data-curve')).toBe('more-is-better');
        const initialButtons = previewStack.querySelectorAll('.score-button');
        expect(initialButtons.length).toBe(5);

        // Switch to boolean mode
        responseTypeSelector.value = 'boolean';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));

        expect(previewElement.getAttribute('data-response-type')).toBe('boolean');
        expect(previewElement.hasAttribute('data-curve')).toBe(false);
        const booleanButtons = previewStack.querySelectorAll('.score-button');
        expect(booleanButtons.length).toBe(2);
        expect(booleanButtons[0].textContent.trim()).toBe('Yes');
        expect(booleanButtons[1].textContent.trim()).toBe('No');

        // Switch back to scale mode
        responseTypeSelector.value = 'scale';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));

        expect(previewElement.getAttribute('data-response-type')).toBe('scale');
        expect(previewElement.getAttribute('data-curve')).toBe('more-is-better');
        const restoredButtons = previewStack.querySelectorAll('.score-button');
        expect(restoredButtons.length).toBe(5);
    });
});

describe('Yes/No Question Type — Wire Selector Into Save/Edit Tests', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
    });

    it('passes responseType: "boolean" to createCustomQuestion when saving new custom question through UI', async () => {
        const addQuestionButton = documentInstance.getElementById('button-add-question');
        addQuestionButton.click();

        const textInput = documentInstance.getElementById('q-text');
        const shortLabelInput = documentInstance.getElementById('q-short-label');
        const tagsInput = documentInstance.getElementById('q-tags');
        const responseTypeSelector = documentInstance.getElementById('q-response-type');
        const saveButton = documentInstance.getElementById('button-save-question');

        textInput.value = 'Did you take your medication today?';
        shortLabelInput.value = 'Medication';
        tagsInput.value = 'Health, Meds';
        textInput.dispatchEvent(new windowInstance.Event('input'));
        shortLabelInput.dispatchEvent(new windowInstance.Event('input'));

        responseTypeSelector.value = 'boolean';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));

        expect(saveButton.disabled).toBe(false);
        await saveQuestionFromAuthoring();

        const allQuestions = await getAll('questions');
        const savedQuestion = allQuestions.find(question => question.text === 'Did you take your medication today?');
        expect(savedQuestion).toBeDefined();
        expect(savedQuestion.responseType).toBe('boolean');
        expect(savedQuestion.shortLabel).toBe('Medication');
    });

    it('defaults to responseType: "scale" when saving new custom question through UI', async () => {
        const addQuestionButton = documentInstance.getElementById('button-add-question');
        addQuestionButton.click();

        const textInput = documentInstance.getElementById('q-text');
        const shortLabelInput = documentInstance.getElementById('q-short-label');
        const responseTypeSelector = documentInstance.getElementById('q-response-type');

        textInput.value = 'How rested do you feel today?';
        shortLabelInput.value = 'Rested';
        textInput.dispatchEvent(new windowInstance.Event('input'));
        shortLabelInput.dispatchEvent(new windowInstance.Event('input'));

        expect(responseTypeSelector.value).toBe('scale');
        await saveQuestionFromAuthoring();

        const allQuestions = await getAll('questions');
        const savedQuestion = allQuestions.find(question => question.text === 'How rested do you feel today?');
        expect(savedQuestion).toBeDefined();
        expect(savedQuestion.responseType).toBe('scale');
    });

    it('populates responseType and hides scale fields when opening edit modal on boolean question', async () => {
        const outcome = await createCustomQuestion({
            text: 'Did you exercise today?',
            shortLabel: 'Exercise',
            tags: ['Fitness'],
            responseType: 'boolean',
            addToSet: true
        });

        await navigateToQuestionsCanvas(windowInstance, documentInstance);
        await openQuestionAuthoringDialog(documentInstance, outcome.id, 'edit');

        const responseTypeSelector = documentInstance.getElementById('q-response-type');
        const scaleFieldsContainer = documentInstance.getElementById('scale-only-fields');
        const previewElement = documentInstance.getElementById('question-preview');
        const previewStack = documentInstance.getElementById('question-preview-stack');

        // Verify selector is populated
        expect(responseTypeSelector.value).toBe('boolean');

        // Verify scale fields are immediately hidden on open without requiring user interaction
        expect(scaleFieldsContainer.hidden).toBe(true);

        // Verify live preview immediately reflects boolean Yes/No
        expect(previewElement.getAttribute('data-response-type')).toBe('boolean');
        expect(previewElement.hasAttribute('data-curve')).toBe(false);
        const buttons = previewStack.querySelectorAll('.score-button');
        expect(buttons.length).toBe(2);
        expect(buttons[0].textContent.trim()).toBe('Yes');
        expect(buttons[1].textContent.trim()).toBe('No');
    });

    it('populates responseType and shows scale fields when opening edit modal on a scale question', async () => {
        const outcome = await createCustomQuestion({
            text: 'How calm was your day?',
            shortLabel: 'Calmness',
            tags: ['Mind'],
            curve: 'more-is-better',
            responseType: 'scale',
            addToSet: true
        });

        await navigateToQuestionsCanvas(windowInstance, documentInstance);
        await openQuestionAuthoringDialog(documentInstance, outcome.id, 'edit');

        const responseTypeSelector = documentInstance.getElementById('q-response-type');
        const scaleFieldsContainer = documentInstance.getElementById('scale-only-fields');
        const previewElement = documentInstance.getElementById('question-preview');

        expect(responseTypeSelector.value).toBe('scale');
        expect(scaleFieldsContainer.hidden).toBe(false);
        expect(previewElement.getAttribute('data-response-type')).toBe('scale');
        expect(previewElement.getAttribute('data-curve')).toBe('more-is-better');
    });

    it('changes responseType and persists to storage when editing an existing question', async () => {
        const outcome = await createCustomQuestion({
            text: 'Did you drink water today?',
            shortLabel: 'Water',
            tags: ['Habit'],
            responseType: 'scale',
            addToSet: true
        });

        await navigateToQuestionsCanvas(windowInstance, documentInstance);
        const overlay = await openQuestionAuthoringDialog(documentInstance, outcome.id, 'edit');

        const responseTypeSelector = documentInstance.getElementById('q-response-type');
        const scaleFieldsContainer = documentInstance.getElementById('scale-only-fields');

        // Switch from scale to boolean
        responseTypeSelector.value = 'boolean';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));
        expect(scaleFieldsContainer.hidden).toBe(true);

        await saveQuestionFromAuthoring();
        await waitFor(() => !overlay.classList.contains('is-open'));

        const inDb = await get('questions', outcome.id);
        expect(inDb.responseType).toBe('boolean');
    });

    it('populates responseType and immediately syncs field visibility when copying a question', async () => {
        await navigateToQuestionsCanvas(windowInstance, documentInstance);
        await openQuestionAuthoringDialog(documentInstance, 'q_eaten', 'copy');

        const responseTypeSelector = documentInstance.getElementById('q-response-type');
        const scaleFieldsContainer = documentInstance.getElementById('scale-only-fields');
        const previewElement = documentInstance.getElementById('question-preview');

        expect(responseTypeSelector.value).toBe('boolean');
        expect(scaleFieldsContainer.hidden).toBe(true);
        expect(previewElement.getAttribute('data-response-type')).toBe('boolean');
    });
});
