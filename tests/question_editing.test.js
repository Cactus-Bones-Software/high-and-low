// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import {
    createCustomQuestion,
    updateCustomQuestion,
    archiveCustomQuestion,
    restoreCustomQuestion
} from '../public/js/questions.js';
import { getAll, getConfig } from '../public/js/storage/db.js';
import { loadQuestionsView } from '../public/js/ui/question-view.js';

let domInstance;
let windowInstance;
let documentInstance;

describe('Task 5.7: Question Editing & Archiving Workflow', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;

        // Navigate to questions view
        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const catalogList = documentInstance.getElementById('questions-catalog-list');
            return Boolean(catalogList && catalogList.children.length > 0);
        });
    });

    it('1. Core DB: updateCustomQuestion updates custom question attributes while preserving ID and immutability rules', async () => {
        const createResult = await createCustomQuestion({
            text: 'How focused were you today?',
            shortLabel: 'Focus Level',
            tags: ['work', 'mind'],
            curve: 'more-is-better',
            minLabel: 'Low',
            maxLabel: 'High',
            addToSet: true
        });

        expect(createResult.status).toBe('added');
        const questionId = createResult.question.id;
        const originalCreatedAt = createResult.question.createdAt;
        const originalText = createResult.question.originalText;

        const updated = await updateCustomQuestion(questionId, {
            text: 'How super focused were you today?',
            shortLabel: 'Deep Focus',
            tags: ['productivity', 'flow'],
            curve: 'less-is-better',
            minLabel: 'Distracted',
            maxLabel: 'Locked In'
        });

        expect(updated.id).toBe(questionId);
        expect(updated.originalText).toBe(originalText);
        expect(updated.createdAt).toBe(originalCreatedAt);
        expect(updated.text).toBe('How super focused were you today?');
        expect(updated.shortLabel).toBe('Deep Focus');
        expect(updated.tags).toEqual(['productivity', 'flow']);
        expect(updated.curve).toBe('less-is-better');
        expect(updated.minLabel).toBe('Distracted');
        expect(updated.maxLabel).toBe('Locked In');
        expect(updated.builtIn).toBe(false);
        expect(updated.archived).toBe(false);

        // Verify database persistence
        const allQuestions = await getAll('questions');
        const dbRecord = allQuestions.find(q => q.id === questionId);
        expect(dbRecord.text).toBe('How super focused were you today?');
        expect(dbRecord.shortLabel).toBe('Deep Focus');
    });

    it('2. Core DB: Immutability enforcement - built-in questions throw error when attempted to edit or archive', async () => {
        // Built-in question q_energy
        await expect(updateCustomQuestion('q_energy', { text: 'New Energy Text', shortLabel: 'Energy' }))
            .rejects.toThrow('Built-in questions cannot be edited.');

        await expect(archiveCustomQuestion('q_energy'))
            .rejects.toThrow('Built-in questions cannot be archived.');
    });

    it('3. Soft Archiving & Restoring: Soft-archiving marks question archived and removes from active tracker', async () => {
        const createResult = await createCustomQuestion({
            text: 'Daily Hydration Intake',
            shortLabel: 'Hydration',
            tags: ['health'],
            curve: 'more-is-better',
            addToSet: true
        });
        const questionId = createResult.question.id;

        // Check active set initially contains questionId
        let activeSet = await getConfig('activeQuestionSet');
        expect(activeSet).toContain(questionId);

        // Soft-archive question
        const archivedQuestion = await archiveCustomQuestion(questionId);
        expect(archivedQuestion.archived).toBe(true);

        // Check active set no longer contains questionId
        activeSet = await getConfig('activeQuestionSet');
        expect(activeSet).not.toContain(questionId);

        // Check DB record still exists and has archived: true
        const allQuestions = await getAll('questions');
        const dbRecord = allQuestions.find(q => q.id === questionId);
        expect(dbRecord).not.toBeUndefined();
        expect(dbRecord.archived).toBe(true);

        // Restore custom question
        const restoredQuestion = await restoreCustomQuestion(questionId);
        expect(restoredQuestion.archived).toBe(false);

        const restoredQuestions = await getAll('questions');
        const restoredDbRecord = restoredQuestions.find(q => q.id === questionId);
        expect(restoredDbRecord.archived).toBe(false);
    });

    it('4. UI Workflow: Built-in question cards have Copy button and no Archive button', async () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const builtInCard = Array.from(activeList.children).find(card => {
            const badge = card.querySelector('.question-card-badge');
            return badge && badge.textContent.trim() === 'Built-in';
        });

        expect(builtInCard).not.toBeNull();
        const copyButton = builtInCard.querySelector('.question-copy-button');
        expect(copyButton).not.toBeNull();
        expect(copyButton.disabled).toBe(false);
        expect(copyButton.textContent.trim()).toBe('Copy');
        expect(copyButton.getAttribute('data-action')).toBe('copy-question');

        const archiveButton = builtInCard.querySelector('.question-archive-button');
        expect(archiveButton).toBeNull();
    });

    it('5. UI Workflow: Archiving custom question renders it in Archived section with Restore button', async () => {
        // Create custom question
        await createCustomQuestion({
            text: 'Meditation minutes',
            shortLabel: 'Meditation',
            tags: ['mindfulness'],
            curve: 'more-is-better',
            addToSet: false
        });

        // Load view to render newly created question into DOM
        await loadQuestionsView();

        const catalogList = documentInstance.getElementById('questions-catalog-list');
        const customCard = Array.from(catalogList.children).find(card => {
            const text = card.querySelector('.question-card-text');
            return text && text.textContent.includes('Meditation minutes');
        });
        expect(customCard).not.toBeUndefined();

        const archiveButton = customCard.querySelector('.question-archive-button');
        expect(archiveButton).not.toBeNull();

        // Click Archive button
        archiveButton.click();

        await waitFor(() => {
            const archivedSection = documentInstance.getElementById('questions-archived-section');
            return Boolean(archivedSection && !archivedSection.hidden);
        });

        const archivedList = documentInstance.getElementById('questions-archived-list');
        expect(archivedList.children.length).toBeGreaterThan(0);

        const archivedCard = Array.from(archivedList.children).find(card => {
            const text = card.querySelector('.question-card-text');
            return text && text.textContent.includes('Meditation minutes');
        });
        expect(archivedCard).not.toBeUndefined();

        const badge = archivedCard.querySelector('.question-card-badge');
        expect(badge.textContent.trim()).toBe('Archived');

        const restoreButton = archivedCard.querySelector('.question-restore-button');
        expect(restoreButton).not.toBeNull();

        // Click restore button
        restoreButton.click();

        await waitFor(() => {
            const updatedCatalogList = documentInstance.getElementById('questions-catalog-list');
            return Boolean(Array.from(updatedCatalogList.children).some(card => {
                const text = card.querySelector('.question-card-text');
                return text && text.textContent.includes('Meditation minutes');
            }));
        });
    });
});
