// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { setupTestDOM, waitFor } from './test-utils.js';

describe('Task 5.8: Removed Questions Section & Search Visibility', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;

        // Wait for IndexedDB initialization and seeding
        await waitFor(() => windowInstance.getAll && typeof windowInstance.getAll === 'function');
    });

    it('1. Removed questions are placed inside the catalog without a separate section header', async () => {
        // Verify no removed/archived section header exists in DOM
        const removedHeading = documentInstance.getElementById('questions-archived-heading');
        expect(removedHeading).toBeNull();

        // Verify the removed section is inside the main catalog section
        const catalogHeading = documentInstance.getElementById('questions-catalog-heading');
        expect(catalogHeading).not.toBeNull();
        const catalogSection = catalogHeading.closest('section');
        expect(catalogSection).not.toBeNull();

        const toggleButton = catalogSection.querySelector('#button-toggle-removed-questions');
        expect(toggleButton).not.toBeNull();

        const removedSection = catalogSection.querySelector('#questions-archived-section');
        expect(removedSection).not.toBeNull();
    });

    it('2. Toggle button is hidden when there are no removed questions, and section is normally hidden', async () => {
        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const activeList = documentInstance.getElementById('questions-active-list');
            return Boolean(activeList && activeList.children.length > 0);
        });

        const toggleButton = documentInstance.getElementById('button-toggle-removed-questions');
        const removedSection = documentInstance.getElementById('questions-archived-section');

        // With zero removed questions initially, toggle button and section are hidden
        expect(toggleButton.hidden).toBe(true);
        expect(removedSection.hidden).toBe(true);
    });

    it('3. Dialog button says "Remove Question" and card buttons say "Remove"', async () => {
        const creationOutcome = await windowInstance.createCustomQuestion({
            text: 'Did you make time for deep reading today?',
            shortLabel: 'Reading Time',
            tags: ['Leisure', 'Intellect'],
            curve: 'more-is-better',
            addToSet: true
        });

        const questionId = creationOutcome.id;

        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const customCard = documentInstance.querySelector(
                `#questions-active-list [data-question-id="${questionId}"]`
            );
            return Boolean(customCard);
        });

        const customCard = documentInstance.querySelector(
            `#questions-active-list [data-question-id="${questionId}"]`
        );
        const removeCardButton = customCard.querySelector('.question-remove-button, .question-archive-button');
        expect(removeCardButton).not.toBeNull();
        expect(removeCardButton.textContent.trim()).toBe('Remove');
        expect(removeCardButton.getAttribute('aria-label')).toContain('Remove question');

        // Open edit dialog
        const editButton = customCard.querySelector('.question-edit-button');
        editButton.click();

        const overlay = documentInstance.getElementById('question-authoring-dialog-overlay');
        await waitFor(() => overlay.classList.contains('is-open'));

        const dialogRemoveButton = documentInstance.getElementById('button-archive-question');
        expect(dialogRemoveButton).not.toBeNull();
        expect(dialogRemoveButton.textContent.trim()).toBe('Remove Question');
        expect(dialogRemoveButton.getAttribute('aria-label')).toContain('Remove question');

        // Cancel modal
        windowInstance.cancelQuestionAuthoring();
        await waitFor(() => !overlay.classList.contains('is-open'));
    });

    it('4. Toggle button shows and hides removed questions below it', async () => {
        // Create and remove a custom question
        const creationOutcome = await windowInstance.createCustomQuestion({
            text: 'Did you practice guitar chords today?',
            shortLabel: 'Guitar Practice',
            tags: ['Music'],
            curve: 'more-is-better',
            addToSet: false
        });

        const questionId = creationOutcome.id;
        await windowInstance.archiveQuestion(questionId);

        // Reset visibility state so we test normally hidden state
        if (typeof windowInstance.setRemovedQuestionsExpanded === 'function') {
            windowInstance.setRemovedQuestionsExpanded(false);
        }

        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const toggleButton = documentInstance.getElementById('button-toggle-removed-questions');
            return Boolean(toggleButton && !toggleButton.hidden);
        });

        const toggleButton = documentInstance.getElementById('button-toggle-removed-questions');
        const removedSection = documentInstance.getElementById('questions-archived-section');

        // Initially normally hidden
        expect(toggleButton.hidden).toBe(false);
        expect(toggleButton.textContent.trim()).toBe('Show Removed Questions');
        expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
        expect(removedSection.hidden).toBe(true);

        // Click toggle button to show removed questions
        toggleButton.click();
        await waitFor(() => !removedSection.hidden);

        expect(toggleButton.textContent.trim()).toBe('Hide Removed Questions');
        expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
        expect(removedSection.hidden).toBe(false);

        const removedCard = documentInstance.querySelector(
            `#questions-archived-list [data-question-id="${questionId}"]`
        );
        expect(removedCard).not.toBeNull();

        // Click toggle button again to hide removed questions
        toggleButton.click();
        await waitFor(() => removedSection.hidden);

        expect(toggleButton.textContent.trim()).toBe('Show Removed Questions');
        expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
        expect(removedSection.hidden).toBe(true);
    });

    it('5. Search only shows removed questions if the removed questions section is being shown', async () => {
        const creationOutcome = await windowInstance.createCustomQuestion({
            text: 'How much caffeine did you consume today?',
            shortLabel: 'Caffeine Intake',
            tags: ['Habits'],
            curve: 'less-is-better',
            addToSet: false
        });

        const questionId = creationOutcome.id;
        await windowInstance.archiveQuestion(questionId);

        // Reset visibility so removed section is hidden
        if (typeof windowInstance.setRemovedQuestionsExpanded === 'function') {
            windowInstance.setRemovedQuestionsExpanded(false);
        }

        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const toggleButton = documentInstance.getElementById('button-toggle-removed-questions');
            return Boolean(toggleButton && !toggleButton.hidden);
        });

        const searchInput = documentInstance.getElementById('questions-search-input');
        const removedSection = documentInstance.getElementById('questions-archived-section');
        const toggleButton = documentInstance.getElementById('button-toggle-removed-questions');

        // Verify removed section is hidden
        expect(removedSection.hidden).toBe(true);

        // Search for term that only exists in the removed question
        searchInput.value = 'caffeine';
        searchInput.dispatchEvent(new windowInstance.Event('input'));

        await waitFor(() => {
            const catalogEmpty = documentInstance.getElementById('questions-catalog-empty');
            return Boolean(catalogEmpty && !catalogEmpty.hidden);
        });

        // The removed questions section MUST REMAIN HIDDEN when search is performed and section is not expanded
        expect(removedSection.hidden).toBe(true);
        expect(documentInstance.querySelector(
            `#questions-archived-list [data-question-id="${questionId}"]`
        )).toBeNull();

        // Now user clicks "Show Removed Questions" while search is active
        toggleButton.click();
        await waitFor(() => !removedSection.hidden);

        expect(removedSection.hidden).toBe(false);
        const matchingRemovedCard = documentInstance.querySelector(
            `#questions-archived-list [data-question-id="${questionId}"]`
        );
        expect(matchingRemovedCard).not.toBeNull();

        // Search for non-matching term while section is open
        searchInput.value = 'nonexistent term';
        searchInput.dispatchEvent(new windowInstance.Event('input'));

        await waitFor(() => {
            const archivedEmpty = documentInstance.getElementById('questions-archived-empty');
            return Boolean(archivedEmpty && !archivedEmpty.hidden);
        });

        const archivedEmpty = documentInstance.getElementById('questions-archived-empty');
        expect(archivedEmpty.hidden).toBe(false);
        expect(archivedEmpty.textContent).toContain('No removed questions match your search.');
    });

    it('6. Restoring all removed questions hides the toggle button and collapses the section', async () => {
        const creationOutcome = await windowInstance.createCustomQuestion({
            text: 'How restful was your afternoon break?',
            shortLabel: 'Afternoon Rest',
            tags: ['Rest'],
            curve: 'more-is-better',
            addToSet: false
        });

        const questionId = creationOutcome.id;
        await windowInstance.archiveQuestion(questionId);

        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const toggleButton = documentInstance.getElementById('button-toggle-removed-questions');
            return Boolean(toggleButton && !toggleButton.hidden);
        });

        const toggleButton = documentInstance.getElementById('button-toggle-removed-questions');
        toggleButton.click();

        const removedSection = documentInstance.getElementById('questions-archived-section');
        await waitFor(() => !removedSection.hidden);

        const restoreButton = documentInstance.querySelector(
            `#questions-archived-list [data-question-id="${questionId}"] .question-restore-button`
        );
        expect(restoreButton).not.toBeNull();
        restoreButton.click();

        // Wait for restoration to complete
        await waitFor(() => {
            const inDbPromise = windowInstance.get('questions', questionId);
            return inDbPromise.then(question => question && !question.archived);
        });

        // Toggle button and section should now be hidden as there are no removed questions left
        await waitFor(() => toggleButton.hidden && removedSection.hidden);
        expect(toggleButton.hidden).toBe(true);
        expect(removedSection.hidden).toBe(true);
    });

    it('7. Show Removed Questions button has a maximum width and prominent visibility styles in CSS', () => {
        const cssContent = readFileSync(resolve(__dirname, '../public/style.css'), 'utf8');

        // Verify selector exists
        expect(cssContent).toContain('.questions-toggle-removed-button');

        // Verify maximum width constraint exists
        expect(cssContent).toMatch(/\.questions-toggle-removed-button\s*\{[^}]*max-width:\s*320px/);

        // Verify it is centered / aligned
        expect(cssContent).toMatch(/\.questions-toggle-removed-button\s*\{[^}]*align-self:\s*center/);

        // Verify prominent background color and visible border exist (not transparent)
        expect(cssContent).toMatch(/\.questions-toggle-removed-button\s*\{[^}]*background-color:\s*var\(--button-default\)/);
        expect(cssContent).toMatch(/\.questions-toggle-removed-button\s*\{[^}]*border:\s*1px solid var\(--border-color\)/);

        // Verify minimum accessible touch target height
        expect(cssContent).toMatch(/\.questions-toggle-removed-button\s*\{[^}]*min-height:\s*44px/);
    });
});
