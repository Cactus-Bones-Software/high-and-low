// noinspection JSObjectNullOrUndefined

import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDOM } from './test-utils.js';
import {
    BOOLEAN_NO_SCORE,
    BOOLEAN_YES_SCORE,
    DEFAULT_QUESTIONS,
    createCustomQuestion,
    archiveQuestion,
    seedDefaults
} from '../public/js/questions.js';
import { getAll } from '../public/js/storage/db.js';

describe('Yes/No Question Type — Schema Field Tests', () => {
    let _windowInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        _windowInstance = setup.window;
    });

    it('DEFAULT_QUESTIONS explicitly sets responseType on every built-in question', () => {
        const defaultQuestions = DEFAULT_QUESTIONS;
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

    it('seeded questions in IndexedDB contain explicit responseType', async () => {
        const questionsInStore = await getAll('questions');
        expect(questionsInStore.length).toBe(8);

        const scaleQuestions = questionsInStore.filter(question => question.responseType === 'scale');
        expect(scaleQuestions.length).toBe(7);

        const eatenInStore = questionsInStore.find(question => question.id === 'q_eaten');
        expect(eatenInStore).toBeDefined();
        expect(eatenInStore.responseType).toBe('boolean');
        expect(eatenInStore.shortLabel).toBe('Eaten Today');
    });

    it('createCustomQuestion defaults responseType to "scale" when omitted', async () => {
        const result = await createCustomQuestion({
            text: 'How anxious are you feeling?',
            shortLabel: 'Anxiety',
            tags: ['Mental Health'],
            curve: 'less-is-better',
            addToSet: true
        });

        expect(result.id).toBeDefined();
        const stored = await getAll('questions');
        const customQuestion = stored.find(question => question.id === result.id);
        expect(customQuestion).toBeDefined();
        expect(customQuestion.responseType).toBe('scale');
    });

    it('createCustomQuestion persists responseType: "boolean" when provided', async () => {
        const result = await createCustomQuestion({
            text: 'Did you shower today?',
            shortLabel: 'Shower',
            tags: ['Hygiene'],
            responseType: 'boolean',
            addToSet: true
        });

        expect(result.id).toBeDefined();
        const stored = await getAll('questions');
        const customQuestion = stored.find(question => question.id === result.id);
        expect(customQuestion).toBeDefined();
        expect(customQuestion.responseType).toBe('boolean');
    });

    it('createCustomQuestion throws when responseType is invalid', async () => {
        await expect(
            createCustomQuestion({
                text: 'Invalid response type test',
                shortLabel: 'Invalid',
                responseType: 'slider',
                addToSet: false
            })
        ).rejects.toThrow(/Invalid responseType/);

        await expect(
            createCustomQuestion({
                text: 'Another invalid type test',
                shortLabel: 'Invalid2',
                responseType: 123,
                addToSet: false
            })
        ).rejects.toThrow(/Invalid responseType/);
    });

    it('createCustomQuestion persists responseType on restore-from-archive path', async () => {
        const initial = await createCustomQuestion({
            text: 'Did you stretch today?',
            shortLabel: 'Stretch',
            responseType: 'boolean',
            addToSet: true
        });
        expect(initial.status).toBe('added');

        await archiveQuestion(initial.id);
        const storedAfterArchive = await getAll('questions');
        const archivedRecord = storedAfterArchive.find(question => question.id === initial.id);
        expect(archivedRecord.archived).toBe(true);

        // Restore same question with responseType: "boolean"
        const restored = await createCustomQuestion({
            text: 'Did you stretch today?',
            shortLabel: 'Stretching',
            responseType: 'boolean',
            addToSet: true
        });
        expect(restored.status).toBe('restored');

        const storedAfterRestore = await getAll('questions');
        const restoredRecord = storedAfterRestore.find(question => question.id === initial.id);
        expect(restoredRecord.archived).toBe(false);
        expect(restoredRecord.responseType).toBe('boolean');
    });

    it('seedDefaults backfills responseType: "scale" on pre-existing stored records', async () => {
        const legacyQuestion = {
            id: 'legacy_custom_q',
            text: 'Legacy un-typed question',
            originalText: 'Legacy un-typed question',
            shortLabel: 'Legacy',
            tags: ['General'],
            curve: 'more-is-better',
            minLabel: 'Low',
            midLabel: '',
            maxLabel: 'High',
            archived: false,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z'
            // responseType intentionally omitted to simulate legacy stored question
        };

        const { put } = await import('../public/js/storage/db.js');
        await put('questions', legacyQuestion);

        const beforeSeed = await getAll('questions');
        const legacyBefore = beforeSeed.find(question => question.id === 'legacy_custom_q');
        expect(legacyBefore.responseType).toBeUndefined();

        // Run seedDefaults
        await seedDefaults();

        const afterSeed = await getAll('questions');
        const legacyAfter = afterSeed.find(question => question.id === 'legacy_custom_q');
        expect(legacyAfter).toBeDefined();
        expect(legacyAfter.responseType).toBe('scale');

        const energyAfter = afterSeed.find(question => question.id === 'q_energy');
        expect(energyAfter.responseType).toBe('scale');
    });
});

describe('Boolean Score Mapping Constants', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
    });

    it('exports BOOLEAN_NO_SCORE and BOOLEAN_YES_SCORE with values 1 and 5', () => {
        expect(BOOLEAN_NO_SCORE).toBe(1);
        expect(BOOLEAN_YES_SCORE).toBe(5);
        expect(typeof BOOLEAN_NO_SCORE).toBe('number');
        expect(typeof BOOLEAN_YES_SCORE).toBe('number');
    });

    it('renders Yes/No buttons mapped to the exported constants in authoring preview', async () => {
        const { navigateToQuestionsCanvas, openQuestionAuthoringDialog } = await import('./test-utils.js');
        await navigateToQuestionsCanvas(windowInstance, documentInstance);
        await openQuestionAuthoringDialog(documentInstance, 'q_eaten', 'copy');

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
