// @vitest-environment jsdom
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

describe('Task 5.5: Active Tracker Cards, Reordering Handles & In-Tracker Toggle', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;

        // Navigate to questions view to populate the lists
        windowInstance.navigateTo('questions-canvas', { instant: true });
        await waitFor(() => {
            const activeList = documentInstance.getElementById('questions-active-list');
            return Boolean(activeList && activeList.children.length > 0);
        });
    });

    it('1. Active Card Structure: Renders active cards with question text, tags, reordering, and toggle switch below badge', () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        expect(activeList).not.toBeNull();
        expect(activeList.children.length).toBe(windowInstance.STATE.activeQuestions.length);

        const firstCard = activeList.children[0];
        expect(firstCard.classList.contains('question-card')).toBe(true);
        expect(firstCard.classList.contains('question-card-active')).toBe(true);

        const questionText = firstCard.querySelector('.question-card-text');
        expect(questionText).not.toBeNull();
        expect(questionText.textContent).toBeTruthy();

        const shortLabel = firstCard.querySelector('.question-card-short-label');
        expect(shortLabel).not.toBeNull();
        expect(shortLabel.textContent).toBe('Energy Level');
        expect(firstCard.innerHTML).not.toContain('&lt;p class="question-card-short-label"&gt;');

        const statusGroup = firstCard.querySelector('.question-card-status-group');
        expect(statusGroup).not.toBeNull();
        const badge = statusGroup.querySelector('.question-card-badge');
        expect(badge).not.toBeNull();

        const toggleButton = statusGroup.querySelector('.question-tracker-toggle');
        expect(toggleButton).not.toBeNull();
        expect(toggleButton.getAttribute('role')).toBe('switch');
        expect(toggleButton.getAttribute('aria-checked')).toBe('true');
        expect(toggleButton.querySelector('.toggle-text')).toBeNull();

        const reorderControls = firstCard.querySelector('.question-reorder-controls');
        expect(reorderControls).not.toBeNull();

        const upButton = firstCard.querySelector('button[data-action="move-up"]');
        const downButton = firstCard.querySelector('button[data-action="move-down"]');
        expect(upButton).not.toBeNull();
        expect(downButton).not.toBeNull();

        // First item cannot move up
        expect(upButton.disabled).toBe(true);
        expect(downButton.disabled).toBe(false);
    });

    it('2. Boundary Buttons: Last active card has move-down disabled and move-up enabled', () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const totalCards = activeList.children.length;
        expect(totalCards).toBeGreaterThanOrEqual(2);

        const lastCard = activeList.children[totalCards - 1];
        const upButton = lastCard.querySelector('button[data-action="move-up"]');
        const downButton = lastCard.querySelector('button[data-action="move-down"]');

        expect(upButton.disabled).toBe(false);
        expect(downButton.disabled).toBe(true);
    });

    it('3. Reordering Sequence: Clicking move-down swaps order and persists in config', async () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const firstCardId = activeList.children[0].getAttribute('data-question-id');
        const secondCardId = activeList.children[1].getAttribute('data-question-id');

        const downButton = activeList.children[0].querySelector('button[data-action="move-down"]');
        downButton.click();

        await waitFor(() => {
            const updatedActiveList = documentInstance.getElementById('questions-active-list');
            return updatedActiveList.children[0].getAttribute('data-question-id') === secondCardId;
        });

        // Verify DOM sequence
        expect(activeList.children[0].getAttribute('data-question-id')).toBe(secondCardId);
        expect(activeList.children[1].getAttribute('data-question-id')).toBe(firstCardId);

        // Verify STATE and IndexedDB persistence
        expect(windowInstance.STATE.activeQuestions[0].id).toBe(secondCardId);
        expect(windowInstance.STATE.activeQuestions[1].id).toBe(firstCardId);

        const storedConfig = await windowInstance.getConfig('activeQuestionSet');
        expect(storedConfig[0]).toBe(secondCardId);
        expect(storedConfig[1]).toBe(firstCardId);
    });

    it('4. Reordering Sequence: Clicking move-up moves question up and updates disabled states', async () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const secondCard = activeList.children[1];
        const secondCardId = secondCard.getAttribute('data-question-id');

        const upButton = secondCard.querySelector('button[data-action="move-up"]');
        expect(upButton.disabled).toBe(false);
        upButton.click();

        await waitFor(() => {
            const updatedActiveList = documentInstance.getElementById('questions-active-list');
            return updatedActiveList.children[0].getAttribute('data-question-id') === secondCardId;
        });

        const newFirstCard = activeList.children[0];
        const newUpButton = newFirstCard.querySelector('button[data-action="move-up"]');
        expect(newUpButton.disabled).toBe(true);
    });

    it('5. In-Tracker Toggle: Clicking toggle switch removes question from active set into catalog, and adding from catalog', async () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const catalogList = document.getElementById('questions-catalog-list');
        const headingCatalog = documentInstance.getElementById('questions-catalog-heading');
        const divider = documentInstance.querySelector('.questions-divider');

        expect(headingCatalog).not.toBeNull();
        expect(headingCatalog.textContent).toBe('Question Catalog');
        expect(divider).not.toBeNull();

        const initialActiveCount = activeList.children.length;
        const initialCatalogCount = catalogList.children.length;
        // Catalog contains all 7 default questions, while active list has 4
        expect(initialActiveCount).toBe(4);
        expect(initialCatalogCount).toBe(7);

        const targetCard = activeList.children[0];
        const targetQuestionId = targetCard.getAttribute('data-question-id');

        const toggleButton = targetCard.querySelector('.question-tracker-toggle');
        expect(toggleButton.getAttribute('aria-checked')).toBe('true');
        toggleButton.click();

        await waitFor(() => {
            const updatedActiveList = documentInstance.getElementById('questions-active-list');
            return updatedActiveList.children.length === initialActiveCount - 1;
        });

        expect(documentInstance.querySelector(`#questions-active-list [data-question-id="${targetQuestionId}"]`)).toBeNull();

        // Verify question remains in catalog and presents inactive switch toggle
        const catalogCard = documentInstance.querySelector(`#questions-catalog-list [data-question-id="${targetQuestionId}"]`);
        expect(catalogCard).not.toBeNull();
        expect(catalogList.children.length).toBe(initialCatalogCount);

        const catalogToggle = catalogCard.querySelector('.question-tracker-toggle');
        expect(catalogToggle).not.toBeNull();
        expect(catalogToggle.getAttribute('role')).toBe('switch');
        expect(catalogToggle.getAttribute('aria-checked')).toBe('false');

        // Verify STATE and IndexedDB persistence
        expect(windowInstance.STATE.activeQuestions.some(question => question.id === targetQuestionId)).toBe(false);
        const storedConfig = await windowInstance.getConfig('activeQuestionSet');
        expect(storedConfig.includes(targetQuestionId)).toBe(false);

        // Click toggle in catalog to re-add to active tracker
        catalogToggle.click();

        await waitFor(() => {
            const updatedActiveList = documentInstance.getElementById('questions-active-list');
            return updatedActiveList.children.length === initialActiveCount;
        });

        expect(documentInstance.querySelector(`#questions-active-list [data-question-id="${targetQuestionId}"]`)).not.toBeNull();
        const updatedCatalogCard = documentInstance.querySelector(`#questions-catalog-list [data-question-id="${targetQuestionId}"]`);
        expect(updatedCatalogCard.querySelector('.question-tracker-toggle').getAttribute('aria-checked')).toBe('true');
    });

    it('6. Layout & CSS Rules: Status group holds badge and toggle, reorder controls in action row', () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const firstCard = activeList.children[0];

        const statusGroup = firstCard.querySelector('.question-card-status-group');
        expect(statusGroup).not.toBeNull();
        expect(statusGroup.querySelector('.question-card-badge')).not.toBeNull();
        expect(statusGroup.querySelector('.question-tracker-toggle')).not.toBeNull();

        const actionRow = firstCard.querySelector('.card-action-row');
        expect(actionRow).not.toBeNull();

        const nonDominantActions = firstCard.querySelector('.card-actions-non-dominant');
        expect(nonDominantActions).not.toBeNull();
        expect(nonDominantActions.querySelector('.question-reorder-controls')).not.toBeNull();

        const cssContent = readFileSync(resolve(__dirname, '../public/style.css'), 'utf8');
        expect(cssContent).toContain('.question-card-status-group');
        expect(cssContent).toContain('.question-card-actions');
        expect(cssContent).toContain('.question-reorder-controls');
        expect(cssContent).toContain('.question-reorder-button');
        expect(cssContent).toContain('.question-tracker-toggle');
    });

    it('7. Drag Handle Structure: Center placement, quarter-width sizing, and grip lines', () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const firstCard = activeList.children[0];

        const centerSlot = firstCard.querySelector('.card-actions-center');
        expect(centerSlot).not.toBeNull();

        const dragHandle = centerSlot.querySelector('.question-drag-handle');
        expect(dragHandle).not.toBeNull();
        expect(dragHandle.getAttribute('draggable')).toBe('true');
        expect(dragHandle.getAttribute('aria-label')).toContain('Drag to reorder');
        expect(dragHandle.querySelector('.drag-handle-bar')).not.toBeNull();

        const cssContent = readFileSync(resolve(__dirname, '../public/style.css'), 'utf8');
        expect(cssContent).toContain('.card-actions-center');
        expect(cssContent).toContain('.question-drag-handle');
        expect(cssContent).toContain('width: 25%');
        expect(cssContent).toContain('flex: 0 0 25%');
    });

    it('8. Drag and Drop Reordering: Dragging card drops into new position and persists order', async () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const firstCard = activeList.children[0];
        const secondCard = activeList.children[1];
        const firstId = firstCard.getAttribute('data-question-id');
        const secondId = secondCard.getAttribute('data-question-id');

        // Simulate HTML5 drag and drop from first card to drop on second card
        let setDragImageCalledWith = null;
        const dragEvent = new windowInstance.Event('dragstart', { bubbles: true });
        const mockDataTransfer = {
            data: {},
            setData(key, value) { this.data[key] = value; },
            getData(key) { return this.data[key]; },
            effectAllowed: 'none',
            dropEffect: 'none',
            setDragImage(element, x, y) {
                setDragImageCalledWith = { element, x, y };
            }
        };
        dragEvent.dataTransfer = mockDataTransfer;

        const firstHandle = firstCard.querySelector('.question-drag-handle');
        firstHandle.dispatchEvent(dragEvent);
        expect(mockDataTransfer.getData('text/plain')).toBe(firstId);
        expect(setDragImageCalledWith).not.toBeNull();
        expect(setDragImageCalledWith.element).toBe(firstCard);

        // Simulate drop onto second card
        const dropEvent = new windowInstance.Event('drop', { bubbles: true });
        dropEvent.dataTransfer = mockDataTransfer;
        dropEvent.clientY = 100;
        // Mock getBoundingClientRect
        secondCard.getBoundingClientRect = () => ({
            top: 50,
            bottom: 150,
            height: 100,
            left: 0,
            right: 300,
            width: 300
        });

        secondCard.dispatchEvent(dropEvent);

        await waitFor(() => {
            const updatedActiveList = documentInstance.getElementById('questions-active-list');
            return updatedActiveList.children[0].getAttribute('data-question-id') === secondId;
        });

        const updatedActiveList = documentInstance.getElementById('questions-active-list');
        expect(updatedActiveList.children[0].getAttribute('data-question-id')).toBe(secondId);
        expect(updatedActiveList.children[1].getAttribute('data-question-id')).toBe(firstId);

        const storedConfig = await windowInstance.getConfig('activeQuestionSet');
        expect(storedConfig[0]).toBe(secondId);
        expect(storedConfig[1]).toBe(firstId);
    });

    it('9. Drag Handle Keyboard Navigation: Arrow keys reorder active question sequence', async () => {
        const activeList = documentInstance.getElementById('questions-active-list');
        const firstCard = activeList.children[0];
        const secondCard = activeList.children[1];
        const firstId = firstCard.getAttribute('data-question-id');
        const secondId = secondCard.getAttribute('data-question-id');

        const firstHandle = firstCard.querySelector('.question-drag-handle');
        firstHandle.dispatchEvent(new windowInstance.KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true
        }));

        await waitFor(() => {
            const updatedActiveList = documentInstance.getElementById('questions-active-list');
            return updatedActiveList.children[0].getAttribute('data-question-id') === secondId;
        });

        const updatedActiveList = documentInstance.getElementById('questions-active-list');
        expect(updatedActiveList.children[0].getAttribute('data-question-id')).toBe(secondId);
        expect(updatedActiveList.children[1].getAttribute('data-question-id')).toBe(firstId);
    });
});
