import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';

describe('Task 5.10.1: Yes/No Question Type — Schema Field Tests', () => {
    let windowInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. DEFAULT_QUESTIONS explicitly sets responseType on every built-in question', () => {
        const defaultQuestions = windowInstance.DEFAULT_QUESTIONS;
        expect(Array.isArray(defaultQuestions)).toBe(true);
        expect(defaultQuestions.length).toBe(8);

        defaultQuestions.forEach(question => {
            expect(['scale', 'boolean']).toContain(question.responseType);
        });

        const scaleQuestions = defaultQuestions.filter(question => question.responseType === 'scale');
        expect(scaleQuestions.length).toBe(7);

        const booleanQuestions = defaultQuestions.filter(question => question.responseType === 'boolean');
        expect(booleanQuestions.length).toBe(1);
        expect(booleanQuestions[0].id).toBe('q_eaten');
        expect(booleanQuestions[0].text).toBe('Have you eaten today?');
    });

    it('2. Seeded questions in IndexedDB contain explicit responseType', async () => {
        const questionsInStore = await windowInstance.getAll('questions');
        expect(questionsInStore.length).toBe(8);

        const scaleQuestions = questionsInStore.filter(question => question.responseType === 'scale');
        expect(scaleQuestions.length).toBe(7);

        const eatenInStore = questionsInStore.find(question => question.id === 'q_eaten');
        expect(eatenInStore).toBeTruthy();
        expect(eatenInStore.responseType).toBe('boolean');
        expect(eatenInStore.builtIn).toBe(true);
    });

    it('3. createCustomQuestion defaults responseType to "scale" when omitted', async () => {
        const outcome = await windowInstance.createCustomQuestion({
            text: 'How focused were you today?',
            shortLabel: 'Focus Level',
            curve: 'more-is-better',
            addToSet: false
        });

        expect(outcome.status).toBe('added');
        expect(outcome.question.responseType).toBe('scale');

        const inStore = await windowInstance.get('questions', outcome.id);
        expect(inStore.responseType).toBe('scale');
    });

    it('4. createCustomQuestion persists responseType: "boolean" when provided', async () => {
        const outcome = await windowInstance.createCustomQuestion({
            text: 'Did you take your medication today?',
            shortLabel: 'Medication Taken',
            responseType: 'boolean',
            addToSet: false
        });

        expect(outcome.status).toBe('added');
        expect(outcome.question.responseType).toBe('boolean');

        const inStore = await windowInstance.get('questions', outcome.id);
        expect(inStore.responseType).toBe('boolean');
    });

    it('5. createCustomQuestion throws when responseType is invalid', async () => {
        await expect(windowInstance.createCustomQuestion({
            text: 'Invalid response type question',
            shortLabel: 'Invalid',
            responseType: 'slider'
        })).rejects.toThrow(/Invalid responseType/);

        await expect(windowInstance.createCustomQuestion({
            text: 'Invalid response type question 2',
            shortLabel: 'Invalid 2',
            responseType: 'number'
        })).rejects.toThrow(/Invalid responseType/);
    });

    it('6. createCustomQuestion persists responseType on restore-from-archive path', async () => {
        const initial = await windowInstance.createCustomQuestion({
            text: 'Did you exercise today?',
            shortLabel: 'Exercise',
            responseType: 'scale',
            addToSet: false
        });

        await windowInstance.archiveQuestion(initial.id);
        const archived = await windowInstance.get('questions', initial.id);
        expect(archived.archived).toBe(true);

        const restoredOutcome = await windowInstance.createCustomQuestion({
            text: 'Did you exercise today?',
            shortLabel: 'Exercise Daily',
            responseType: 'boolean',
            addToSet: false
        });

        expect(restoredOutcome.status).toBe('restored');
        expect(restoredOutcome.question.archived).toBe(false);
        expect(restoredOutcome.question.responseType).toBe('boolean');

        const inStore = await windowInstance.get('questions', initial.id);
        expect(inStore.responseType).toBe('boolean');
    });

    it('7. seedDefaults backfills responseType: "scale" on pre-existing stored records', async () => {
        // Create a legacy custom record without responseType
        const legacyCustomQuestion = {
            id: 'c_legacy123',
            text: 'Did you drink enough water?',
            shortLabel: 'Water Intake',
            tags: ['Health'],
            builtIn: false,
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await windowInstance.put('questions', legacyCustomQuestion);

        const beforeSeed = await windowInstance.get('questions', 'c_legacy123');
        expect(beforeSeed.responseType).toBeUndefined();

        // Also remove responseType from a built-in question in DB
        const energyBefore = await windowInstance.get('questions', 'q_energy');
        delete energyBefore.responseType;
        await windowInstance.put('questions', energyBefore);

        // Run seedDefaults
        await windowInstance.seedDefaults();

        const customAfter = await windowInstance.get('questions', 'c_legacy123');
        expect(customAfter.responseType).toBe('scale');

        const energyAfter = await windowInstance.get('questions', 'q_energy');
        expect(energyAfter.responseType).toBe('scale');
    });
});

describe('Task 5.10.2: Yes/No Question Type — Authoring Dialog Field Tests', () => {
    let windowInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. Markup has response type selector matching form field conventions', () => {
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

    it('2. Selecting Yes/No hides scale-only fields and selecting 5-Point Scale shows them', async () => {
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

        expect(responseTypeSelector.value).toBe('scale');
        expect(scaleFieldsContainer.hidden).toBe(false);
        expect(curveField.hidden).toBe(false);
        expect(maxLabelField.hidden).toBe(false);
        expect(minLabelField.hidden).toBe(false);
        expect(scaleHint.hidden).toBe(false);

        // Switch to boolean (Yes/No)
        responseTypeSelector.value = 'boolean';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));

        expect(scaleFieldsContainer.hidden).toBe(true);
        expect(curveField.hidden).toBe(true);
        expect(maxLabelField.hidden).toBe(true);
        expect(minLabelField.hidden).toBe(true);
        expect(scaleHint.hidden).toBe(true);

        // Switch back to 5-Point Scale
        responseTypeSelector.value = 'scale';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));

        expect(scaleFieldsContainer.hidden).toBe(false);
        expect(curveField.hidden).toBe(false);
        expect(maxLabelField.hidden).toBe(false);
        expect(minLabelField.hidden).toBe(false);
        expect(scaleHint.hidden).toBe(false);
    });

    it('3. Live preview reflects selected response type', async () => {
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

describe('Task 5.10.3: Yes/No Question Type — Wire Selector Into Save/Edit Tests', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. Saving new custom question through UI passes responseType: "boolean" to createCustomQuestion', async () => {
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
        await windowInstance.saveQuestionFromAuthoring();

        const allQuestions = await windowInstance.getAll('questions');
        const savedQuestion = allQuestions.find(question => question.text === 'Did you take your medication today?');
        expect(savedQuestion).toBeDefined();
        expect(savedQuestion.responseType).toBe('boolean');
        expect(savedQuestion.shortLabel).toBe('Medication');
    });

    it('2. Saving new custom question through UI defaults to responseType: "scale"', async () => {
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
        await windowInstance.saveQuestionFromAuthoring();

        const allQuestions = await windowInstance.getAll('questions');
        const savedQuestion = allQuestions.find(question => question.text === 'How rested do you feel today?');
        expect(savedQuestion).toBeDefined();
        expect(savedQuestion.responseType).toBe('scale');
    });

    it('3. Opening edit modal on boolean question populates responseType and hides scale fields', async () => {
        const outcome = await windowInstance.createCustomQuestion({
            text: 'Did you exercise today?',
            shortLabel: 'Exercise',
            tags: ['Fitness'],
            responseType: 'boolean',
            addToSet: true
        });

        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const list = documentInstance.getElementById('questions-active-list');
            return Boolean(list?.querySelector(`[data-question-id="${outcome.id}"]`));
        });

        const customCard = documentInstance.querySelector(`[data-question-id="${outcome.id}"]`);
        const editButton = customCard.querySelector('.question-edit-button');
        editButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));

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

    it('4. Opening edit modal on a scale question populates responseType and shows scale fields', async () => {
        const outcome = await windowInstance.createCustomQuestion({
            text: 'How calm was your day?',
            shortLabel: 'Calmness',
            tags: ['Mind'],
            curve: 'more-is-better',
            responseType: 'scale',
            addToSet: true
        });

        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const list = documentInstance.getElementById('questions-active-list');
            return Boolean(list?.querySelector(`[data-question-id="${outcome.id}"]`));
        });

        const customCard = documentInstance.querySelector(`[data-question-id="${outcome.id}"]`);
        const editButton = customCard.querySelector('.question-edit-button');
        editButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));

        const responseTypeSelector = documentInstance.getElementById('q-response-type');
        const scaleFieldsContainer = documentInstance.getElementById('scale-only-fields');
        const previewElement = documentInstance.getElementById('question-preview');

        expect(responseTypeSelector.value).toBe('scale');
        expect(scaleFieldsContainer.hidden).toBe(false);
        expect(previewElement.getAttribute('data-response-type')).toBe('scale');
        expect(previewElement.getAttribute('data-curve')).toBe('more-is-better');
    });

    it('5. Editing an existing question can change responseType and persists to storage', async () => {
        const outcome = await windowInstance.createCustomQuestion({
            text: 'Did you drink water today?',
            shortLabel: 'Water',
            tags: ['Habit'],
            responseType: 'scale',
            addToSet: true
        });

        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const list = documentInstance.getElementById('questions-active-list');
            return Boolean(list?.querySelector(`[data-question-id="${outcome.id}"]`));
        });

        const customCard = documentInstance.querySelector(`[data-question-id="${outcome.id}"]`);
        const editButton = customCard.querySelector('.question-edit-button');
        editButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));

        const responseTypeSelector = documentInstance.getElementById('q-response-type');
        const scaleFieldsContainer = documentInstance.getElementById('scale-only-fields');

        // Switch from scale to boolean
        responseTypeSelector.value = 'boolean';
        responseTypeSelector.dispatchEvent(new windowInstance.Event('change'));
        expect(scaleFieldsContainer.hidden).toBe(true);

        await windowInstance.saveQuestionFromAuthoring();
        await waitFor(() => !overlay.classList.contains('is-open'));

        const inDb = await windowInstance.get('questions', outcome.id);
        expect(inDb.responseType).toBe('boolean');
    });

    it('6. Copying a question populates responseType and immediately syncs field visibility', async () => {
        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const card = documentInstance.querySelector('#questions-catalog-list [data-question-id="q_eaten"]');
            return Boolean(card);
        });

        const eatenCard = documentInstance.querySelector('#questions-catalog-list [data-question-id="q_eaten"]');
        expect(eatenCard).not.toBeNull();

        const copyButton = eatenCard.querySelector('.question-copy-button');
        expect(copyButton).not.toBeNull();
        copyButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));

        const responseTypeSelector = documentInstance.getElementById('q-response-type');
        const scaleFieldsContainer = documentInstance.getElementById('scale-only-fields');
        const previewElement = documentInstance.getElementById('question-preview');

        expect(responseTypeSelector.value).toBe('boolean');
        expect(scaleFieldsContainer.hidden).toBe(true);
        expect(previewElement.getAttribute('data-response-type')).toBe('boolean');
    });
});
