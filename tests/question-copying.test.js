// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import { getAll } from '../public/js/storage/db.js';

let windowInstance;
let documentInstance;

describe('Task 5.9: Built-In Question Copying Workflow', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;

        // Navigate to questions view
        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const catalogList = documentInstance.getElementById('questions-catalog-list');
            return Boolean(catalogList && catalogList.children.length > 0);
        });
    });

    it('1. UI: Built-in question cards render an active Copy button', async () => {
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
    });

    it('2. Workflow: Clicking Copy opens authoring dialog pre-filled with built-in question details', async () => {
        const builtInCard = documentInstance.querySelector(
            '#questions-active-list [data-question-id="q_overall"]'
        );
        expect(builtInCard).not.toBeNull();

        const copyButton = builtInCard.querySelector('.question-copy-button');
        copyButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));
        expect(overlay.classList.contains('is-open')).toBe(true);

        const modalTitle = documentInstance.getElementById('question-authoring-dialog-title');
        expect(modalTitle.textContent).toBe('Copy Question');

        const textInput = documentInstance.getElementById('q-text');
        expect(textInput.value).toBe('Overall, where does your mood sit right now?');

        const shortLabelInput = documentInstance.getElementById('q-short-label');
        expect(shortLabelInput.value).toBe('Overall Mood');

        const archiveRow = documentInstance.getElementById('archive-question-row');
        expect(archiveRow.hidden).toBe(true);
    });

    it('3. Validation: Saving without modifying question text fails with wiggle, red outline, and message', async () => {
        const builtInCard = documentInstance.querySelector(
            '#questions-active-list [data-question-id="q_overall"]'
        );
        expect(builtInCard).not.toBeNull();

        const copyButton = builtInCard.querySelector('.question-copy-button');
        copyButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));

        const saveButton = documentInstance.getElementById('button-save-question');
        const textInput = documentInstance.getElementById('q-text');
        const errorBanner = documentInstance.getElementById('question-form-error');

        const initialQuestions = await getAll('questions');
        const initialCount = initialQuestions.length;

        // Attempt save without changes
        await windowInstance.saveQuestionFromAuthoring();

        // Check validation failure state
        expect(overlay.classList.contains('is-open')).toBe(true);
        expect(errorBanner.hidden).toBe(false);
        expect(errorBanner.textContent).toContain('Please change the question text');
        expect(textInput.classList.contains('is-invalid')).toBe(true);
        expect(textInput.getAttribute('aria-invalid')).toBe('true');
        expect(saveButton.classList.contains('button-wiggle')).toBe(true);

        // Verify no new question was created
        const currentQuestions = await getAll('questions');
        expect(currentQuestions.length).toBe(initialCount);
    });

    it('4. Success: Modifying question text clears error and successfully saves new custom question', async () => {
        const builtInCard = documentInstance.querySelector(
            '#questions-active-list [data-question-id="q_overall"]'
        );
        expect(builtInCard).not.toBeNull();

        const copyButton = builtInCard.querySelector('.question-copy-button');
        copyButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));

        const textInput = documentInstance.getElementById('q-text');
        const errorBanner = documentInstance.getElementById('question-form-error');

        // Trigger validation error first
        await windowInstance.saveQuestionFromAuthoring();
        expect(errorBanner.hidden).toBe(false);
        expect(textInput.classList.contains('is-invalid')).toBe(true);

        // Edit text
        textInput.value = 'How vibrant did your mood feel today?';
        textInput.dispatchEvent(new windowInstance.Event('input'));

        // Typing clears validation error
        expect(errorBanner.hidden).toBe(true);
        expect(textInput.classList.contains('is-invalid')).toBe(false);

        // Save
        await windowInstance.saveQuestionFromAuthoring();

        await waitFor(() => !overlay.classList.contains('is-open'));
        expect(overlay.classList.contains('is-open')).toBe(false);

        // Verify question in database
        const allQuestions = await getAll('questions');
        const copiedQuestion = allQuestions.find(question =>
            question.text === 'How vibrant did your mood feel today?'
        );
        expect(copiedQuestion).not.toBeUndefined();
        expect(copiedQuestion.builtIn).toBeFalsy();
        expect(copiedQuestion.shortLabel).toBe('Overall Mood');
        expect(copiedQuestion.id).not.toBe('q_overall');
    });
});
