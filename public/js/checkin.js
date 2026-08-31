/**
 * HIGH & LOW - CHECK-IN WORKFLOW ENGINE
 * Scoring, question rendering, transitions, response persistence, and check-in lifecycle.
 */

import { STATE } from './state.js';
import { getDatabase, put } from './storage/db.js';
import { saveActiveCheckin, clearActiveCheckin } from './storage/session.js';
import { loadActiveQuestions } from './questions.js';
import { safeRAF, escapeHTML } from './utils.js';

export function buildScoreButtonsHTML(question) {
    if (!question) return '';
    let buttonsHTML = '';
    for (let score = 5; score >= 1; score--) {
        let rawContextLabel = '';
        if (score === 5) rawContextLabel = question.maxLabel || '';
        else if (score === 1) rawContextLabel = question.minLabel || '';
        else if (score === 3 && question.curve === 'middle-is-best') rawContextLabel = question.midLabel || '';

        const fullAriaLabel = `Score ${score} out of 5${rawContextLabel ? ': ' + rawContextLabel : ''}`;
        const escapedAriaLabel = escapeHTML(fullAriaLabel);
        const escapedContextLabel = escapeHTML(rawContextLabel);

        buttonsHTML += `
      <button type="button" class="score-button" data-score="${score}" aria-label="${escapedAriaLabel}">
        <span class="num" aria-hidden="true">${score}</span>
        <span class="label-desc">${escapedContextLabel}</span>
      </button>
    `;
    }
    return buttonsHTML;
}

export function renderCurrentQuestion() {
    const currentQuestion = STATE.activeQuestions[STATE.currentQuestionIndex];

    if (!currentQuestion) {
        finalizeCheckin();
        return;
    }

    const progressElement = document.getElementById('progress-text');
    if (progressElement) {
        progressElement.textContent = `Question ${STATE.currentQuestionIndex + 1} of ${STATE.activeQuestions.length}`;
    }

    const questionTextElement = document.getElementById('question-text');
    if (questionTextElement) {
        questionTextElement.textContent = currentQuestion.text;
    }

    const inputBox = document.getElementById('input-box');
    if (inputBox) {
        inputBox.setAttribute('data-curve', currentQuestion.curve);
    }

    const buttonStack = document.getElementById('button-stack');
    if (buttonStack) {
        buttonStack.innerHTML = buildScoreButtonsHTML(currentQuestion);
    }

    document.querySelectorAll('.score-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const targetScore = parseInt(event.currentTarget.getAttribute('data-score'), 10);
            handleScoreSubmission(currentQuestion.id, targetScore);
        });
    });
}

export function clearQuestionTransitions() {
    const headerBox = document.getElementById('header-box');
    const inputBox = document.getElementById('input-box');
    if (headerBox) {
        headerBox.classList.remove('question-transition-out', 'question-transition-enter', 'question-transition-in');
    }
    if (inputBox) {
        inputBox.classList.remove('question-transition-out', 'question-transition-enter', 'question-transition-in');
    }
}

export function handleScoreSubmission(questionId, score) {
    STATE.checkinAnswers.push({ questionId, score, status: 'answered' });
    STATE.currentQuestionIndex++;
    saveActiveCheckin();

    // If check-in is complete after this score, finalize cleanly without question advance transition
    if (STATE.currentQuestionIndex >= STATE.activeQuestions.length) {
        clearQuestionTransitions();
        finalizeCheckin();
        return;
    }

    const headerBox = document.getElementById('header-box');
    const inputBox = document.getElementById('input-box');

    // Smooth question transition without screen blanking
    if (headerBox) headerBox.classList.add('question-transition-out');
    if (inputBox) inputBox.classList.add('question-transition-out');

    setTimeout(() => {
        clearQuestionTransitions();
        renderCurrentQuestion();
        if (headerBox) {
            headerBox.classList.add('question-transition-enter');
        }
        if (inputBox) {
            inputBox.classList.add('question-transition-enter');
        }

        safeRAF(() => {
            safeRAF(() => {
                if (headerBox) {
                    headerBox.classList.remove('question-transition-enter');
                    headerBox.classList.add('question-transition-in');
                    setTimeout(() => headerBox && headerBox.classList.remove('question-transition-in'), 180);
                }
                if (inputBox) {
                    inputBox.classList.remove('question-transition-enter');
                    inputBox.classList.add('question-transition-in');
                    setTimeout(() => inputBox && inputBox.classList.remove('question-transition-in'), 180);
                }
            });
        });
    }, 120);
}

export function startNewCheckIn() {
    clearQuestionTransitions();
    clearActiveCheckin();
    STATE.currentQuestionIndex = 0;
    STATE.checkinAnswers = [];
    STATE.checkinNote = null;

    if (typeof updateNotesButtonLabel === 'function') {
        updateNotesButtonLabel();
    } else if (typeof window !== 'undefined' && typeof window.updateNotesButtonLabel === 'function') {
        window.updateNotesButtonLabel();
    } else {
        const notesButton = document.getElementById('button-notes');
        if (notesButton) {
            const labelSpan = notesButton.querySelector('.button-label');
            if (labelSpan) {
                labelSpan.textContent = 'Add Note';
            }
        }
    }

    const completionView = document.getElementById('completion-view');
    if (completionView) {
        completionView.hidden = true;
    }

    const buttonStack = document.getElementById('button-stack');
    if (buttonStack) {
        buttonStack.hidden = false;
    }

    const footerBox = document.getElementById('footer-box');
    if (footerBox) {
        footerBox.style.display = '';
    }

    return loadActiveQuestions().then(() => {
        renderCurrentQuestion();
    });
}

export function finalizeCheckin() {
    clearQuestionTransitions();
    clearActiveCheckin();
    const answeredIds = new Set(STATE.checkinAnswers.map(answer => answer.questionId));
    STATE.activeQuestions.forEach(question => {
        if (!answeredIds.has(question.id)) {
            STATE.checkinAnswers.push({ questionId: question.id, score: null, status: 'skipped' });
        }
    });

    const now = new Date();
    const checkinEntry = {
        timestamp: now.toISOString(),
        dateString: now.toISOString().split('T')[0],
        note: STATE.checkinNote || null,
        answers: STATE.checkinAnswers
    };

    const progressElement = document.getElementById('progress-text');
    const questionElement = document.getElementById('question-text');
    if (progressElement) progressElement.textContent = "Check-In Complete";
    if (questionElement) questionElement.textContent = "Mood recorded. Rest easy.";

    const buttonStack = document.getElementById('button-stack');
    if (buttonStack) {
        buttonStack.hidden = true;
    }

    const completionView = document.getElementById('completion-view');
    if (completionView) {
        completionView.hidden = false;
    }

    const footerBox = document.getElementById('footer-box');
    if (footerBox) {
        footerBox.style.display = 'none';
    }

    const database = getDatabase();
    if (database) {
        const transaction = database.transaction(['entries'], 'readwrite');
        transaction.objectStore('entries').add(checkinEntry);

        transaction.oncomplete = () => {
            const newCheckinButton = document.getElementById('button-new-checkin');
            if (newCheckinButton) {
                setTimeout(() => newCheckinButton.focus({ preventScroll: true }), 60);
            }
        };
    } else {
        put('entries', checkinEntry).then(() => {
            const newCheckinButton = document.getElementById('button-new-checkin');
            if (newCheckinButton) {
                setTimeout(() => newCheckinButton.focus({ preventScroll: true }), 60);
            }
        });
    }
}
