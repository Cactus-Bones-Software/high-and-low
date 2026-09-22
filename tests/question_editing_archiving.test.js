// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
    setupTestDOM,
    waitFor,
    navigateToQuestionsCanvas,
    openQuestionAuthoringDialog
} from './test-utils.js';

describe('Task 5.7: Question Editing & Archiving Workflow', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;

        // Wait for IndexedDB initialization and seeding
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. updateCustomQuestion preserves immutable fields (id, originalText, builtIn, createdAt) while updating mutable fields', async () => {
        const creationOutcome = await windowInstance.createCustomQuestion({
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

        const updated = await windowInstance.updateCustomQuestion(originalQuestion.id, {
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
        expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(originalQuestion.createdAt).getTime());

        // Verify in IndexedDB
        const retrieved = await windowInstance.get('questions', originalQuestion.id);
        expect(retrieved.text).toBe('How deep was your mental concentration today?');
        expect(retrieved.id).toBe(originalQuestion.id);
        expect(retrieved.originalText).toBe(originalQuestion.originalText);
    });

    it('2. Built-in questions cannot be edited but can be archived/removed', async () => {
        await expect(windowInstance.updateCustomQuestion('q_energy', { text: 'New energy text' }))
            .rejects.toThrow(/Built-in questions cannot be edited/);

        const archived = await windowInstance.archiveQuestion('q_energy');
        expect(archived.archived).toBe(true);

        // Restore for test teardown
        await windowInstance.restoreQuestion('q_energy');
    });

    it('3. archiveQuestion soft-deletes custom question and removes it from activeQuestionSet', async () => {
        const creationOutcome = await windowInstance.createCustomQuestion({
            text: 'How hydrated did you stay today?',
            shortLabel: 'Hydration',
            tags: ['Health'],
            curve: 'more-is-better',
            addToSet: true
        });

        const questionId = creationOutcome.id;

        // Verify it was added to active set
        let activeSet = await windowInstance.getConfig('activeQuestionSet');
        expect(activeSet).toContain(questionId);

        // Archive question
        const archived = await windowInstance.archiveQuestion(questionId);
        expect(archived.archived).toBe(true);

        // Verify active question set no longer contains the archived question
        activeSet = await windowInstance.getConfig('activeQuestionSet');
        expect(activeSet).not.toContain(questionId);

        // Verify in DB
        const inDb = await windowInstance.get('questions', questionId);
        expect(inDb.archived).toBe(true);
    });

    it('4. restoreQuestion sets archived to false', async () => {
        const creationOutcome = await windowInstance.createCustomQuestion({
            text: 'Did you spend time outdoors today?',
            shortLabel: 'Outdoors',
            tags: ['Nature'],
            curve: 'more-is-better',
            addToSet: false
        });

        const questionId = creationOutcome.id;
        await windowInstance.archiveQuestion(questionId);
        let inDb = await windowInstance.get('questions', questionId);
        expect(inDb.archived).toBe(true);

        const restored = await windowInstance.restoreQuestion(questionId);
        expect(restored.archived).toBe(false);

        inDb = await windowInstance.get('questions', questionId);
        expect(inDb.archived).toBe(false);
    });

    it('5. UI Flow: Opening edit modal populates question fields, allows saving updates, and updates view', async () => {
        // Create custom question
        const customOutcome = await windowInstance.createCustomQuestion({
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

        const archiveRow = documentInstance.getElementById('archive-question-row');
        expect(archiveRow.hidden).toBe(false);

        const textInput = documentInstance.getElementById('q-text');
        expect(textInput.value).toBe('How creative did you feel today?');

        const shortLabelInput = documentInstance.getElementById('q-short-label');
        expect(shortLabelInput.value).toBe('Creativity');

        // Modify fields and save
        textInput.value = 'How imaginative was your thinking today?';
        shortLabelInput.value = 'Imagination';
        textInput.dispatchEvent(new windowInstance.Event('input'));
        shortLabelInput.dispatchEvent(new windowInstance.Event('input'));

        await windowInstance.saveQuestionFromAuthoring();

        await waitFor(() => !overlay.classList.contains('is-open'));

        // Verify updated text in DB
        const updatedDb = await windowInstance.get('questions', questionId);
        expect(updatedDb.text).toBe('How imaginative was your thinking today?');
        expect(updatedDb.shortLabel).toBe('Imagination');
    });

    it('6. UI Flow: Archiving via authoring dialog removes card from active/catalog and renders in archived section with restore button', async () => {
        const customOutcome = await windowInstance.createCustomQuestion({
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

        // Execute archive action
        await windowInstance.archiveQuestionFromAuthoring();

        await waitFor(() => !overlay.classList.contains('is-open'));

        // Check that active list no longer has the question
        expect(documentInstance.querySelector(`#questions-active-list [data-question-id="${questionId}"]`)).toBeNull();
        expect(documentInstance.querySelector(`#questions-catalog-list [data-question-id="${questionId}"]`)).toBeNull();

        // Check that archived section shows the question
        const archivedSection = documentInstance.getElementById('questions-archived-section');
        expect(archivedSection.hidden).toBe(false);

        const archivedCard = documentInstance.querySelector(`#questions-archived-list [data-question-id="${questionId}"]`);
        expect(archivedCard).not.toBeNull();
        expect(archivedCard.querySelector('.question-card-badge').textContent).toBe('Archived');

        const restoreButton = archivedCard.querySelector('.question-restore-button');
        expect(restoreButton).not.toBeNull();
        expect(restoreButton.textContent.trim()).toBe('Restore');

        // Click restore button
        restoreButton.click();

        await waitFor(() => {
            const catalogCard = documentInstance.querySelector(`#questions-catalog-list [data-question-id="${questionId}"]`);
            return Boolean(catalogCard);
        });

        // Verify in DB that it is no longer archived
        const inDb = await windowInstance.get('questions', questionId);
        expect(inDb.archived).toBe(false);
    });
});