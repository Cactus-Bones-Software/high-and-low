// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor, navigateToQuestionsCanvas } from './test-utils.js';

let _domInstance;
let windowInstance;
let documentInstance;

describe('Task 5.6: Catalog Cards & Non-Dominant Edit Actions', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        _domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;

        // Navigate to questions view to populate the lists
        await navigateToQuestionsCanvas(windowInstance, documentInstance);
    });

    it('1. Catalog Card Structure: Renders cards with question text, tags, edit button, and toggle switch', () => {
        const catalogList = documentInstance.getElementById('questions-catalog-list');
        expect(catalogList).not.toBeNull();
        expect(catalogList.children.length).toBe(8);

        const firstCard = catalogList.children[0];
        expect(firstCard.classList.contains('question-card')).toBe(true);
        expect(firstCard.classList.contains('question-card-catalog')).toBe(true);

        const questionText = firstCard.querySelector('.question-card-text');
        expect(questionText).not.toBeNull();
        expect(questionText.textContent).toBeTruthy();

        const shortLabel = firstCard.querySelector('.question-card-short-label');
        expect(shortLabel).not.toBeNull();

        const statusBadge = firstCard.querySelector('.question-card-badge');
        expect(statusBadge).not.toBeNull();

        // Toggle switch placed below Built-in label inside header status group (unified cards)
        const statusGroup = firstCard.querySelector('.question-card-status-group');
        expect(statusGroup).not.toBeNull();
        const toggleButton = statusGroup.querySelector('.question-tracker-toggle');
        expect(toggleButton).not.toBeNull();
        expect(toggleButton.getAttribute('role')).toBe('switch');

        // Action button inside action row on non-dominant container (always visible)
        const actionRow = firstCard.querySelector('.card-action-row');
        expect(actionRow).not.toBeNull();
        const nonDominantActions = actionRow.querySelector('.card-actions-non-dominant');
        expect(nonDominantActions).not.toBeNull();
        const copyButton = nonDominantActions.querySelector('.card-action-copy, .question-copy-button');
        expect(copyButton).not.toBeNull();
        expect(copyButton.getAttribute('data-action')).toBe('copy-question');
        expect(copyButton.textContent.trim()).toBe('Copy');

        // Active list card also has action button always visible and has is-reorderable class
        const activeList = documentInstance.getElementById('questions-active-list');
        const firstActiveCard = activeList.children[0];
        expect(firstActiveCard.querySelector('.question-copy-button, .question-edit-button')).not.toBeNull();
        expect(firstActiveCard.classList.contains('is-reorderable')).toBe(true);
        expect(firstCard.classList.contains('is-reorderable')).toBe(false);
    });

    it('2. Toggle Functionality: Toggling an inactive catalog card activates it into active tracker', async () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const catalogList = documentInstance.getElementById('questions-catalog-list');
        const initialActiveCount = activeList.children.length;

        // Find an inactive question in catalog
        const inactiveCard = Array.from(catalogList.children).find(card => {
            const toggle = card.querySelector('.question-tracker-toggle');
            return toggle && toggle.getAttribute('aria-checked') === 'false';
        });
        expect(inactiveCard).not.toBeNull();

        const questionId = inactiveCard.getAttribute('data-question-id');
        const toggle = inactiveCard.querySelector('.question-tracker-toggle');
        toggle.click();

        await waitFor(() => {
            const updatedActiveList = documentInstance.getElementById('questions-active-list');
            return updatedActiveList.children.length === initialActiveCount + 1;
        });

        // Verify active list now has the question
        expect(documentInstance.querySelector(`#questions-active-list [data-question-id="${questionId}"]`)).not.toBeNull();

        // Verify catalog card now shows active toggle state
        const updatedCatalogCard = documentInstance.querySelector(`#questions-catalog-list [data-question-id="${questionId}"]`);
        expect(updatedCatalogCard.querySelector('.question-tracker-toggle').getAttribute('aria-checked')).toBe('true');
    });

    it('3. Handedness Alignment & CSS Rules: Edit button follows non-dominant alignment rule', () => {
        const cssContent = readFileSync(resolve(__dirname, '../public/style.css'), 'utf8');

        // Edit button styles exist
        expect(cssContent).toContain('.question-edit-button');

        // Right-handed: card-action-edit is in non-dominant container (order 1 / left)
        expect(cssContent).toContain('body[data-handedness="right"] .card-action-edit');
        expect(cssContent).toContain('body[data-handedness="right"] .card-actions-non-dominant');

        // Left-handed: card-action-edit is in non-dominant container (order 3 / right)
        expect(cssContent).toContain('body[data-handedness="left"] .card-action-edit');
        expect(cssContent).toContain('body[data-handedness="left"] .card-actions-non-dominant');

        // Dominant actions (toggle) order
        expect(cssContent).toContain('body[data-handedness="right"] .card-actions-dominant');
        expect(cssContent).toContain('body[data-handedness="left"] .card-actions-dominant');
    });
});
