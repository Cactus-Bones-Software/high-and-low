import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import { BOOLEAN_NO_SCORE, BOOLEAN_YES_SCORE } from '../public/js/questions.js';

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

describe('Task 5.11.1: Boolean Score Mapping Constants', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. Exports BOOLEAN_NO_SCORE and BOOLEAN_YES_SCORE with values 1 and 5', () => {
        expect(BOOLEAN_NO_SCORE).toBe(1);
        expect(BOOLEAN_YES_SCORE).toBe(5);
        expect(windowInstance.BOOLEAN_NO_SCORE).toBe(1);
        expect(windowInstance.BOOLEAN_YES_SCORE).toBe(5);
        expect(typeof BOOLEAN_NO_SCORE).toBe('number');
        expect(typeof BOOLEAN_YES_SCORE).toBe('number');
    });

    it('2. Authoring preview renders Yes/No buttons mapped to the exported constants', async () => {
        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const card = documentInstance.querySelector('#questions-catalog-list [data-question-id="q_eaten"]');
            return Boolean(card);
        });

        const eatenCard = documentInstance.querySelector('#questions-catalog-list [data-question-id="q_eaten"]');
        const copyButton = eatenCard.querySelector('.question-copy-button');
        copyButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));

        const yesButton = documentInstance.querySelector(
            '#question-preview-stack .score-button[data-boolean="yes"]'
        );
        const noButton = documentInstance.querySelector(
            '#question-preview-stack .score-button[data-boolean="no"]'
        );

        expect(yesButton).not.toBeNull();
        expect(noButton).not.toBeNull();
        expect(Number(yesButton.getAttribute('data-score'))).toBe(BOOLEAN_YES_SCORE);
        expect(Number(noButton.getAttribute('data-score'))).toBe(BOOLEAN_NO_SCORE);
    });
});

describe('Task 5.11.2: Yes/No Tracker Input Deck', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. buildScoreButtonsHTML renders 2 boolean buttons for boolean questions and 5 for scale', () => {
        const booleanQuestion = {
            id: 'test_boolean',
            text: 'Did you eat today?',
            responseType: 'boolean',
            curve: 'more-is-better'
        };
        const scaleQuestion = {
            id: 'test_scale',
            text: 'How is your mood?',
            responseType: 'scale',
            curve: 'more-is-better',
            minLabel: 'Low',
            maxLabel: 'High'
        };

        const booleanHTML = windowInstance.buildScoreButtonsHTML(booleanQuestion);
        const tempContainer = documentInstance.createElement('div');
        tempContainer.innerHTML = booleanHTML;

        const booleanButtons = tempContainer.querySelectorAll('.score-button');
        expect(booleanButtons.length).toBe(2);

        const yesButton = tempContainer.querySelector('.score-button[data-boolean="yes"]');
        const noButton = tempContainer.querySelector('.score-button[data-boolean="no"]');

        expect(yesButton).not.toBeNull();
        expect(noButton).not.toBeNull();
        expect(Number(yesButton.getAttribute('data-score'))).toBe(BOOLEAN_YES_SCORE);
        expect(Number(noButton.getAttribute('data-score'))).toBe(BOOLEAN_NO_SCORE);
        expect(yesButton.getAttribute('aria-label')).toBe('Yes');
        expect(noButton.getAttribute('aria-label')).toBe('No');
        expect(yesButton.classList.contains('boolean-score-button')).toBe(true);
        expect(noButton.classList.contains('boolean-score-button')).toBe(true);

        const scaleHTML = windowInstance.buildScoreButtonsHTML(scaleQuestion);
        tempContainer.innerHTML = scaleHTML;
        const scaleButtons = tempContainer.querySelectorAll('.score-button');
        expect(scaleButtons.length).toBe(5);
    });

    it('2. renderCurrentQuestion renders 2-button deck for boolean question in tracker', async () => {
        const eatenQuestion = windowInstance.DEFAULT_QUESTIONS.find(question => question.id === 'q_eaten');
        expect(eatenQuestion.responseType).toBe('boolean');

        windowInstance.STATE.activeQuestions = [eatenQuestion];
        windowInstance.STATE.currentQuestionIndex = 0;
        windowInstance.STATE.checkinAnswers = [];

        windowInstance.renderCurrentQuestion();

        const buttonStack = documentInstance.getElementById('button-stack');
        expect(buttonStack).not.toBeNull();
        expect(buttonStack.getAttribute('aria-label')).toBe('Select Yes or No');

        const buttons = buttonStack.querySelectorAll('.score-button');
        expect(buttons.length).toBe(2);

        const yesButton = buttonStack.querySelector('.score-button[data-boolean="yes"]');
        const noButton = buttonStack.querySelector('.score-button[data-boolean="no"]');
        expect(yesButton).not.toBeNull();
        expect(noButton).not.toBeNull();

        const inputBox = documentInstance.getElementById('input-box');
        expect(inputBox.getAttribute('data-response-type')).toBe('boolean');
    });

    it('3. Clicking Yes submits BOOLEAN_YES_SCORE (5) to handleScoreSubmission and answers array', async () => {
        const eatenQuestion = windowInstance.DEFAULT_QUESTIONS.find(question => question.id === 'q_eaten');
        windowInstance.STATE.activeQuestions = [eatenQuestion];
        windowInstance.STATE.currentQuestionIndex = 0;
        windowInstance.STATE.checkinAnswers = [];

        windowInstance.renderCurrentQuestion();

        const yesButton = documentInstance.querySelector('#button-stack .score-button[data-boolean="yes"]');
        yesButton.click();

        expect(windowInstance.STATE.checkinAnswers.length).toBe(1);
        expect(windowInstance.STATE.checkinAnswers[0]).toEqual({
            questionId: 'q_eaten',
            score: BOOLEAN_YES_SCORE,
            status: 'answered'
        });
    });

    it('4. Clicking No submits BOOLEAN_NO_SCORE (1) to handleScoreSubmission and answers array', async () => {
        const eatenQuestion = windowInstance.DEFAULT_QUESTIONS.find(question => question.id === 'q_eaten');
        windowInstance.STATE.activeQuestions = [eatenQuestion];
        windowInstance.STATE.currentQuestionIndex = 0;
        windowInstance.STATE.checkinAnswers = [];

        windowInstance.renderCurrentQuestion();

        const noButton = documentInstance.querySelector('#button-stack .score-button[data-boolean="no"]');
        noButton.click();

        expect(windowInstance.STATE.checkinAnswers.length).toBe(1);
        expect(windowInstance.STATE.checkinAnswers[0]).toEqual({
            questionId: 'q_eaten',
            score: BOOLEAN_NO_SCORE,
            status: 'answered'
        });
    });
});

describe('Task 5.11.3: Boolean Line Rendering — Step Interpolation', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. computeGraphLayout tags series items with responseType', () => {
        const questions = [
            { id: 'scale_q', text: 'Mood', curve: 'more-is-better', responseType: 'scale' },
            { id: 'bool_q', text: 'Eaten', curve: 'more-is-better', responseType: 'boolean' }
        ];
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [
                    { questionId: 'scale_q', score: 3, status: 'answered' },
                    { questionId: 'bool_q', score: 5, status: 'answered' }
                ]
            }
        ];

        const layout = windowInstance.computeGraphLayout({
            entries,
            questions,
            containerWidth: 600,
            timeRange: 'all',
            zoomScale: 1
        });

        expect(layout.series.length).toBe(2);
        expect(layout.series[0].responseType).toBe('scale');
        expect(layout.series[1].responseType).toBe('boolean');
    });

    it('2. renderGraphSVG produces horizontal-then-vertical step for boolean series', () => {
        const booleanQuestion = {
            id: 'bool_q',
            text: 'Eaten today?',
            shortLabel: 'Eaten',
            curve: 'more-is-better',
            responseType: 'boolean'
        };
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [{ questionId: 'bool_q', score: 5, status: 'answered' }]
            },
            {
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [{ questionId: 'bool_q', score: 1, status: 'answered' }]
            }
        ];

        const layout = windowInstance.computeGraphLayout({
            entries,
            questions: [booleanQuestion],
            containerWidth: 600,
            timeRange: 'all',
            zoomScale: 1
        });

        const svgMarkup = windowInstance.renderGraphSVG(layout);
        const tempContainer = documentInstance.createElement('div');
        tempContainer.innerHTML = svgMarkup;

        const pathElement = tempContainer.querySelector('svg g.lines path');
        expect(pathElement).not.toBeNull();

        const pathData = pathElement.getAttribute('d');
        const points = layout.series[0].points;
        expect(points.length).toBe(2);
        const p0 = points[0];
        const p1 = points[1];

        // Expected step path: M x0 y0 L x1 y0 L x1 y1
        const expectedStepPath = `M ${p0.x} ${p0.y} L ${p1.x} ${p0.y} L ${p1.x} ${p1.y}`;
        expect(pathData).toBe(expectedStepPath);
    });

    it('3. renderGraphSVG produces straight diagonal lines for scale series', () => {
        const scaleQuestion = {
            id: 'scale_q',
            text: 'Mood level',
            shortLabel: 'Mood',
            curve: 'more-is-better',
            responseType: 'scale'
        };
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [{ questionId: 'scale_q', score: 5, status: 'answered' }]
            },
            {
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [{ questionId: 'scale_q', score: 1, status: 'answered' }]
            }
        ];

        const layout = windowInstance.computeGraphLayout({
            entries,
            questions: [scaleQuestion],
            containerWidth: 600,
            timeRange: 'all',
            zoomScale: 1
        });

        const svgMarkup = windowInstance.renderGraphSVG(layout);
        const tempContainer = documentInstance.createElement('div');
        tempContainer.innerHTML = svgMarkup;

        const pathElement = tempContainer.querySelector('svg g.lines path');
        expect(pathElement).not.toBeNull();

        const pathData = pathElement.getAttribute('d');
        const points = layout.series[0].points;
        const p0 = points[0];
        const p1 = points[1];

        // Expected scale path: straight diagonal M x0 y0 L x1 y1 (no intermediate L x1 y0)
        const expectedStraightPath = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
        expect(pathData).toBe(expectedStraightPath);
    });

    it('4. Multi-point boolean series steps across alternating Yes/No answers', () => {
        const booleanQuestion = {
            id: 'bool_q',
            text: 'Eaten',
            shortLabel: 'Eaten',
            curve: 'more-is-better',
            responseType: 'boolean'
        };
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [{ questionId: 'bool_q', score: 5, status: 'answered' }]
            },
            {
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [{ questionId: 'bool_q', score: 1, status: 'answered' }]
            },
            {
                timestamp: '2026-08-12T10:00:00.000Z',
                answers: [{ questionId: 'bool_q', score: 5, status: 'answered' }]
            }
        ];

        const layout = windowInstance.computeGraphLayout({
            entries,
            questions: [booleanQuestion],
            containerWidth: 600,
            timeRange: 'all',
            zoomScale: 1
        });

        const svgMarkup = windowInstance.renderGraphSVG(layout);
        const tempContainer = documentInstance.createElement('div');
        tempContainer.innerHTML = svgMarkup;

        const pathElement = tempContainer.querySelector('svg g.lines path');
        const pathData = pathElement.getAttribute('d');
        const points = layout.series[0].points;
        const [p0, p1, p2] = points;

        const expectedPath =
            `M ${p0.x} ${p0.y} L ${p1.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p1.y} L ${p2.x} ${p2.y}`;
        expect(pathData).toBe(expectedPath);
    });

    it('5. Integration: renderLineGraph renders both boolean step and scale diagonal paths', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'scale_q', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better', responseType: 'scale' },
            { id: 'bool_q', text: 'Eaten', shortLabel: 'Eaten', curve: 'more-is-better', responseType: 'boolean' }
        ];
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [
                    { questionId: 'scale_q', score: 2, status: 'answered' },
                    { questionId: 'bool_q', score: 5, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [
                    { questionId: 'scale_q', score: 4, status: 'answered' },
                    { questionId: 'bool_q', score: 1, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries, questions });

        const paths = container.querySelectorAll('svg g.lines path');
        expect(paths.length).toBe(2);

        const scalePathD = paths[0].getAttribute('d');
        const booleanPathD = paths[1].getAttribute('d');

        // Scale path must have only 1 'L' command (start 'M' + 1 destination 'L')
        const scaleLCount = (scalePathD.match(/L/g) || []).length;
        expect(scaleLCount).toBe(1);

        // Boolean step path must have 2 'L' commands for 2 points (horizontal then vertical)
        const booleanLCount = (booleanPathD.match(/L/g) || []).length;
        expect(booleanLCount).toBe(2);
    });
});

describe('Task 5.11.4: Boolean Point Tooltips & Accessible Labels', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. computeGraphLayout tags point items with question responseType', () => {
        const questions = [
            { id: 'scale_q', text: 'Energy', curve: 'more-is-better', responseType: 'scale' },
            { id: 'bool_q', text: 'Eaten', curve: 'more-is-better', responseType: 'boolean' }
        ];
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [
                    { questionId: 'scale_q', score: 3, status: 'answered' },
                    { questionId: 'bool_q', score: BOOLEAN_YES_SCORE, status: 'answered' }
                ]
            }
        ];

        const layout = windowInstance.computeGraphLayout({
            entries,
            questions,
            containerWidth: 600,
            timeRange: 'all',
            zoomScale: 1
        });

        expect(layout.series[0].points[0].responseType).toBe('scale');
        expect(layout.series[1].points[0].responseType).toBe('boolean');
    });

    it('2. Boolean points render "Yes" for BOOLEAN_YES_SCORE in aria-label and <title>', () => {
        const booleanQuestion = {
            id: 'bool_q',
            text: 'Have you eaten today?',
            shortLabel: 'Eaten',
            curve: 'more-is-better',
            responseType: 'boolean'
        };
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [{ questionId: 'bool_q', score: BOOLEAN_YES_SCORE, status: 'answered' }]
            }
        ];

        const layout = windowInstance.computeGraphLayout({
            entries,
            questions: [booleanQuestion],
            containerWidth: 600,
            timeRange: 'all',
            zoomScale: 1
        });

        const svgMarkup = windowInstance.renderGraphSVG(layout);
        const tempContainer = documentInstance.createElement('div');
        tempContainer.innerHTML = svgMarkup;

        const circle = tempContainer.querySelector('svg g.points circle');
        expect(circle).not.toBeNull();

        const ariaLabel = circle.getAttribute('aria-label');
        const titleText = circle.querySelector('title').textContent;

        expect(ariaLabel).toContain('Eaten: Yes');
        expect(ariaLabel).not.toContain('Score 5');
        expect(titleText).toContain('Eaten: Yes');
        expect(titleText).not.toContain('Score 5/5');
    });

    it('3. Boolean points render "No" for BOOLEAN_NO_SCORE in aria-label and <title>', () => {
        const booleanQuestion = {
            id: 'bool_q',
            text: 'Have you eaten today?',
            shortLabel: 'Eaten',
            curve: 'more-is-better',
            responseType: 'boolean'
        };
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [{ questionId: 'bool_q', score: BOOLEAN_NO_SCORE, status: 'answered' }]
            }
        ];

        const layout = windowInstance.computeGraphLayout({
            entries,
            questions: [booleanQuestion],
            containerWidth: 600,
            timeRange: 'all',
            zoomScale: 1
        });

        const svgMarkup = windowInstance.renderGraphSVG(layout);
        const tempContainer = documentInstance.createElement('div');
        tempContainer.innerHTML = svgMarkup;

        const circle = tempContainer.querySelector('svg g.points circle');
        expect(circle).not.toBeNull();

        const ariaLabel = circle.getAttribute('aria-label');
        const titleText = circle.querySelector('title').textContent;

        expect(ariaLabel).toContain('Eaten: No');
        expect(ariaLabel).not.toContain('Score 1');
        expect(titleText).toContain('Eaten: No');
        expect(titleText).not.toContain('Score 1/5');
    });

    it('4. Scale points retain "Score X/5" in <title> and "Score X" in aria-label unchanged', () => {
        const scaleQuestion = {
            id: 'scale_q',
            text: 'Mood level',
            shortLabel: 'Mood',
            curve: 'more-is-better',
            responseType: 'scale'
        };
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [{ questionId: 'scale_q', score: 3, status: 'answered' }]
            }
        ];

        const layout = windowInstance.computeGraphLayout({
            entries,
            questions: [scaleQuestion],
            containerWidth: 600,
            timeRange: 'all',
            zoomScale: 1
        });

        const svgMarkup = windowInstance.renderGraphSVG(layout);
        const tempContainer = documentInstance.createElement('div');
        tempContainer.innerHTML = svgMarkup;

        const circle = tempContainer.querySelector('svg g.points circle');
        expect(circle).not.toBeNull();

        const ariaLabel = circle.getAttribute('aria-label');
        const titleText = circle.querySelector('title').textContent;

        expect(ariaLabel).toContain('Mood: Score 3');
        expect(titleText).toContain('Mood: Score 3/5');
    });

    it('5. Integration: renderLineGraph renders Yes/No tooltips for boolean & Score X/5 for scale', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            {
                id: 'scale_q',
                text: 'Energy level',
                shortLabel: 'Energy',
                curve: 'more-is-better',
                responseType: 'scale'
            },
            {
                id: 'bool_q',
                text: 'Have you eaten?',
                shortLabel: 'Eaten',
                curve: 'more-is-better',
                responseType: 'boolean'
            }
        ];
        const entries = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [
                    { questionId: 'scale_q', score: 4, status: 'answered' },
                    { questionId: 'bool_q', score: BOOLEAN_YES_SCORE, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [
                    { questionId: 'scale_q', score: 2, status: 'answered' },
                    { questionId: 'bool_q', score: BOOLEAN_NO_SCORE, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries, questions });

        const circles = container.querySelectorAll('svg g.points circle');
        expect(circles.length).toBe(4);

        const circleTexts = Array.from(circles).map(circle => ({
            label: circle.getAttribute('aria-label'),
            title: circle.querySelector('title').textContent
        }));

        // Two circles for scale_q: should have Score 4 and Score 2
        const scalePoint1 = circleTexts.find(circleText =>
            circleText.label.includes('Energy') && circleText.label.includes('Score 4')
        );
        const scalePoint2 = circleTexts.find(circleText =>
            circleText.label.includes('Energy') && circleText.label.includes('Score 2')
        );
        expect(scalePoint1).toBeDefined();
        expect(scalePoint1.title).toContain('Score 4/5');
        expect(scalePoint2).toBeDefined();
        expect(scalePoint2.title).toContain('Score 2/5');

        // Two circles for bool_q: should have Yes and No
        const booleanPointYes = circleTexts.find(circleText =>
            circleText.label.includes('Eaten') && circleText.label.includes('Yes')
        );
        const booleanPointNo = circleTexts.find(circleText =>
            circleText.label.includes('Eaten') && circleText.label.includes('No')
        );
        expect(booleanPointYes).toBeDefined();
        expect(booleanPointYes.title).toContain('Eaten: Yes');
        expect(booleanPointYes.title).not.toContain('/5');
        expect(booleanPointNo).toBeDefined();
        expect(booleanPointNo.title).toContain('Eaten: No');
        expect(booleanPointNo.title).not.toContain('/5');
    });
});


