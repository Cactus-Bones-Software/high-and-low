// @vitest-environment jsdom
// noinspection JSObjectNullOrUndefined

import { describe, it, expect, beforeEach } from 'vitest';
import {
    setupTestDOM,
    waitFor,
    navigateToQuestionsCanvas,
    openQuestionAuthoringDialog
} from './test-utils.js';
import {
    createCustomQuestion,
    updateCustomQuestion,
    removeQuestion,
    restoreQuestion
} from '../public/js/questions.js';
import { get, getAll, getConfig } from '../public/js/storage/db.js';
import {
    saveQuestionFromAuthoring,
    removeQuestionFromAuthoring
} from '../public/js/ui/question-view.js';

describe('Question Editing Workflow', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;

        // Wait for IndexedDB initialization and seeding
        await waitFor(() => getAll && typeof getAll === 'function');
    });

    it('preserves immutable fields (id, originalText, builtIn, createdAt) while updating mutable fields', async () => {
        const creationOutcome = await createCustomQuestion({
            text: 'How focused were you on your primary project today?',
            shortLabel: 'Focus Duration',
            tags: ['Productivity', 'Work'],
            curve: 'more-is-better',
            minLabel: 'Scattered',
            maxLabel: 'Deep Flow',
            addToSet: false
        });

        expect(creationOutcome.status).toBe('added');
        const originalQuestion = creationOutcome.question;

        const updated = await updateCustomQuestion(originalQuestion.id, {
            text: 'How deep was your mental concentration today?',
            shortLabel: 'Mental Focus',
            tags: ['Work', 'Cognitive', 'Clarity'],
            curve: 'middle-is-best',
            minLabel: 'Brain Fog',
            midLabel: 'Ideal Flow',
            maxLabel: 'Hyperfocused / Tunnel'
        });

        expect(updated.id).toBe(originalQuestion.id);
        expect(updated.originalText).toBe(originalQuestion.originalText);
        expect(updated.createdAt).toBe(originalQuestion.createdAt);
        expect(updated.builtIn).toBe(false);
        expect(updated.text).toBe('How deep was your mental concentration today?');
        expect(updated.shortLabel).toBe('Mental Focus');
        expect(updated.tags).toEqual(['Work', 'Cognitive', 'Clarity']);
        expect(updated.curve).toBe('middle-is-best');
        expect(updated.minLabel).toBe('Brain Fog');
        expect(updated.midLabel).toBe('Ideal Flow');
        expect(updated.maxLabel).toBe('Hyperfocused / Tunnel');
        expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
            new Date(originalQuestion.createdAt).getTime()
        );

        // Verify in IndexedDB
        const retrieved = await get('questions', originalQuestion.id);
        expect(retrieved.text).toBe('How deep was your mental concentration today?');
        expect(retrieved.id).toBe(originalQuestion.id);
        expect(retrieved.originalText).toBe(originalQuestion.originalText);
    });

    it('allows editing of built-in questions in place and tracks text history', async () => {
        const originalBuiltIn = await get('questions', 'q_energy');
        expect(originalBuiltIn).not.toBeNull();
        expect(originalBuiltIn.builtIn).toBe(true);

        const updated = await updateCustomQuestion('q_energy', {
            text: 'How high was your physical energy level today?'
        });

        expect(updated.id).toBe('q_energy');
        expect(updated.originalText).toBe(originalBuiltIn.originalText);
        expect(updated.builtIn).toBe(true);
        expect(updated.text).toBe('How high was your physical energy level today?');
        expect(Array.isArray(updated.textHistory)).toBe(true);
        expect(updated.textHistory.length).toBe(1);
        expect(updated.textHistory[0].text).toBe('How high was your physical energy level today?');
        expect(typeof updated.textHistory[0].changedAt).toBe('string');
    });

    it('soft-deletes custom question and removes it from activeQuestionSet on removeQuestion', async () => {
        const creationOutcome = await createCustomQuestion({
            text: 'How hydrated did you stay today?',
            shortLabel: 'Hydration',
            tags: ['Health'],
            curve: 'more-is-better',
            addToSet: true
        });

        const questionId = creationOutcome.id;

        // Verify it was added to active set
        let activeSet = await getConfig('activeQuestionSet');
        expect(activeSet).toContain(questionId);

        // Remove question
        const removed = await removeQuestion(questionId);
        expect(removed.archived).toBe(true);

        // Verify active question set no longer contains the removed question
        activeSet = await getConfig('activeQuestionSet');
        expect(activeSet).not.toContain(questionId);

        // Verify in DB
        const inDb = await get('questions', questionId);
        expect(inDb.archived).toBe(true);
    });

    it('restores removed question and sets archived to false on restoreQuestion', async () => {
        const creationOutcome = await createCustomQuestion({
            text: 'Did you spend time outdoors today?',
            shortLabel: 'Outdoors',
            tags: ['Nature'],
            curve: 'more-is-better',
            addToSet: false
        });

        const questionId = creationOutcome.id;
        await removeQuestion(questionId);
        let inDb = await get('questions', questionId);
        expect(inDb.archived).toBe(true);

        const restored = await restoreQuestion(questionId);
        expect(restored.archived).toBe(false);

        inDb = await get('questions', questionId);
        expect(inDb.archived).toBe(false);
    });

    it('populates fields, saves updates, and updates view when opening edit modal in UI', async () => {
        // Create custom question
        const customOutcome = await createCustomQuestion({
            text: 'How creative did you feel today?',
            shortLabel: 'Creativity',
            tags: ['Mind', 'Flow'],
            curve: 'more-is-better',
            minLabel: 'Stuck',
            maxLabel: 'Inspired',
            addToSet: true
        });

        const questionId = customOutcome.id;

        // Navigate and open authoring dialog
        await navigateToQuestionsCanvas(windowInstance, documentInstance);
        const overlay = await openQuestionAuthoringDialog(documentInstance, questionId, 'edit');
        expect(overlay.classList.contains('is-open')).toBe(true);

        const modalTitle = documentInstance.getElementById('question-authoring-dialog-title');
        expect(modalTitle.textContent).toBe('Edit Custom Question');

        const saveButton = documentInstance.getElementById('button-save-question');
        expect(saveButton.textContent).toContain('Save Changes');

        const removeRow = documentInstance.getElementById('archive-question-row');
        expect(removeRow.hidden).toBe(false);

        const textInput = documentInstance.getElementById('q-text');
        expect(textInput.value).toBe('How creative did you feel today?');

        const shortLabelInput = documentInstance.getElementById('q-short-label');
        expect(shortLabelInput.value).toBe('Creativity');

        // Modify fields and save
        textInput.value = 'How imaginative was your thinking today?';
        shortLabelInput.value = 'Imagination';
        textInput.dispatchEvent(new windowInstance.Event('input'));
        shortLabelInput.dispatchEvent(new windowInstance.Event('input'));

        await saveQuestionFromAuthoring();

        await waitFor(() => !overlay.classList.contains('is-open'));

        // Verify updated text in DB
        const updatedDb = await get('questions', questionId);
        expect(updatedDb.text).toBe('How imaginative was your thinking today?');
        expect(updatedDb.shortLabel).toBe('Imagination');
    });

    it('removes card from active/catalog and renders in removed questions section with restore button on UI remove', async () => {
        const customOutcome = await createCustomQuestion({
            text: 'How calm was your morning routine?',
            shortLabel: 'Morning Calm',
            tags: ['Routine'],
            curve: 'more-is-better',
            addToSet: true
        });

        const questionId = customOutcome.id;

        // Navigate and open authoring dialog
        await navigateToQuestionsCanvas(windowInstance, documentInstance);
        const overlay = await openQuestionAuthoringDialog(documentInstance, questionId, 'edit');
        expect(overlay.classList.contains('is-open')).toBe(true);

        // Execute remove action
        await removeQuestionFromAuthoring();

        await waitFor(() => !overlay.classList.contains('is-open'));

        // Check that active list no longer has the question
        expect(documentInstance.querySelector(`#questions-active-list [data-question-id="${questionId}"]`)).toBeNull();
        expect(documentInstance.querySelector(`#questions-catalog-list [data-question-id="${questionId}"]`)).toBeNull();

        // Check that removed section shows the question
        const removedSection = documentInstance.getElementById('questions-archived-section');
        expect(removedSection.hidden).toBe(false);

        const removedCard = documentInstance.querySelector(
            `#questions-archived-list [data-question-id="${questionId}"]`
        );
        expect(removedCard).not.toBeNull();
        expect(removedCard.querySelector('.question-card-badge').textContent).toBe('Removed');

        const restoreButton = removedCard.querySelector('.question-restore-button');
        expect(restoreButton).not.toBeNull();
        expect(restoreButton.textContent.trim()).toBe('Restore');

        // Click restore button
        restoreButton.click();

        await waitFor(() => {
            const catalogCard = documentInstance.querySelector(
                `#questions-catalog-list [data-question-id="${questionId}"]`
            );
            return Boolean(catalogCard);
        });

        // Verify in DB that it is no longer removed
        const inDb = await get('questions', questionId);
        expect(inDb.archived).toBe(false);
    });

    it('validates input parameters in updateCustomQuestion', async () => {
        const expectRejection = async (promise, pattern) => {
            let rejectionError = null;
            try {
                await promise;
            } catch (error) {
                rejectionError = error;
            }
            expect(rejectionError).not.toBeNull();
            expect(rejectionError.message).toMatch(pattern);
        };

        await expectRejection(
            updateCustomQuestion('', { text: 'Valid' }),
            /Valid question ID is required/
        );

        const custom = await createCustomQuestion({
            text: 'Valid text for validation test',
            shortLabel: 'Valid',
            tags: ['Test'],
            curve: 'more-is-better'
        });

        await expectRejection(
            updateCustomQuestion(custom.id, { text: '   ' }),
            /Question text cannot be empty/
        );

        await expectRejection(
            updateCustomQuestion(custom.id, { shortLabel: '   ' }),
            /Short label cannot be empty/
        );

        await expectRejection(
            updateCustomQuestion(custom.id, { responseType: 'invalid-type' }),
            /Invalid responseType/
        );
    });
});

