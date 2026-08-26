/**
 * HIGH & LOW - KEYBOARD NAVIGATION
 * Focus ring management, single-key shortcuts (1-5, N, S, M), and arrow key focus cycling.
 */

import { executeHoldAction } from './hold-actions.js';
import { openSettings, closeSettings } from './settings-menu.js';

export function setupKeyboardNavigation() {
    window.addEventListener('scroll', () => {
        if (window.scrollX !== 0 || window.scrollY !== 0) {
            window.scrollTo(0, 0);
        }
    });

    document.addEventListener('keydown', (event) => {
        const activeElement = document.activeElement;
        const isInputActive = activeElement && (
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) ||
            activeElement.isContentEditable
        );

        // Escape key closes settings drawer from anywhere
        if (event.key === 'Escape') {
            if (document.body.classList.contains('settings-open')) {
                closeSettings();
                return;
            }
        }

        if (isInputActive) return; // Do not trigger shortcuts when typing in inputs

        // Keyboard interaction for active mood tracker canvas
        if (!document.body.classList.contains('settings-open')) {
            // Direct score submission via Number keys 1-5
            if (['1', '2', '3', '4', '5'].includes(event.key)) {
                const score = parseInt(event.key, 10);
                const scoreButton = document.querySelector(`.score-button[data-score="${score}"]`);
                if (scoreButton) {
                    scoreButton.focus({ preventScroll: true });
                    scoreButton.click();
                }
                return;
            }

            // Arrow key navigation through ALL interactive controls on the tracker canvas
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                const menuButton = document.getElementById('button-menu');
                const scoreButtons = Array.from(document.querySelectorAll('#button-stack .score-button'));
                const notesButton = document.getElementById('button-notes');
                const skipButton = document.getElementById('button-skip');

                const focusableElements = [];
                if (menuButton) focusableElements.push(menuButton);
                focusableElements.push(...scoreButtons);
                if (notesButton) focusableElements.push(notesButton);
                if (skipButton) focusableElements.push(skipButton);

                if (focusableElements.length === 0) return;

                let currentIndex = focusableElements.indexOf(activeElement);
                event.preventDefault();

                if (currentIndex === -1) {
                    const scoreFiveButton = document.querySelector(`.score-button[data-score="5"]`);
                    if (scoreFiveButton) {
                        scoreFiveButton.focus({ preventScroll: true });
                    } else {
                        focusableElements[0].focus({ preventScroll: true });
                    }
                } else {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                        currentIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
                    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                        currentIndex = (currentIndex + 1) % focusableElements.length;
                    }
                    focusableElements[currentIndex].focus({ preventScroll: true });
                }
                return;
            }

            // Quick key shortcuts
            if (event.key === 'n' || event.key === 'N') {
                event.preventDefault();
                executeHoldAction('button-notes');
                return;
            }
            if (event.key === 's' || event.key === 'S') {
                event.preventDefault();
                executeHoldAction('button-skip');
                return;
            }
            if (event.key === 'm' || event.key === 'M') {
                event.preventDefault();
                openSettings();
            }
        }
    });
}
