// noinspection JSObjectNullOrUndefined

import { beforeEach, describe, expect, it } from 'vitest';
import {
    createSampleBooleanEntries,
    createSampleBooleanQuestion,
    createSampleScaleQuestion,
    renderGraphToContainer,
    setupTestDOM
} from './test-utils.js';
import {
    BOOLEAN_NO_SCORE,
    BOOLEAN_YES_SCORE,
    DEFAULT_QUESTIONS
} from '../public/js/questions.js';
import { buildScoreButtonsHTML, renderCurrentQuestion } from '../public/js/checkin.js';
import { STATE } from '../public/js/state.js';

describe('Yes/No Tracker Input Deck', () => {
    let _windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        _windowInstance = setup.window;
        documentInstance = setup.document;
    });

    it('buildScoreButtonsHTML renders 2 boolean buttons for boolean questions and 5 for scale', () => {
        const booleanQuestion = {
            id: 'test_boolean',
            text: 'Did you eat today?',
            responseType: 'boolean',
            curve: 'more-is-better'
        };
        const scaleQuestion = {
            id: 'test_scale',
            text: 'How is your mood?',
            responseType: 'scale',
            curve: 'more-is-better',
            minLabel: 'Low',
            maxLabel: 'High'
        };

        const booleanHTML = buildScoreButtonsHTML(booleanQuestion);
        const tempContainer = documentInstance.createElement('div');
        tempContainer.innerHTML = booleanHTML;

        const booleanButtons = tempContainer.querySelectorAll('.score-button');
        expect(booleanButtons.length).toBe(2);

        const yesButton = tempContainer.querySelector('.score-button[data-boolean="yes"]');
        const noButton = tempContainer.querySelector('.score-button[data-boolean="no"]');

        expect(yesButton).not.toBeNull();
        expect(noButton).not.toBeNull();
        expect(Number(yesButton.getAttribute('data-score'))).toBe(BOOLEAN_YES_SCORE);
        expect(Number(noButton.getAttribute('data-score'))).toBe(BOOLEAN_NO_SCORE);
        expect(yesButton.getAttribute('aria-label')).toBe('Yes');
        expect(noButton.getAttribute('aria-label')).toBe('No');
        expect(yesButton.classList.contains('boolean-score-button')).toBe(true);
        expect(noButton.classList.contains('boolean-score-button')).toBe(true);

        tempContainer.innerHTML = buildScoreButtonsHTML(scaleQuestion);
        const scaleButtons = tempContainer.querySelectorAll('.score-button');
        expect(scaleButtons.length).toBe(5);
    });

    it('renderCurrentQuestion renders 2-button deck for boolean question in tracker', async () => {
        const eatenQuestion = DEFAULT_QUESTIONS.find(question => question.id === 'q_eaten');
        expect(eatenQuestion.responseType).toBe('boolean');

        STATE.activeQuestions = [eatenQuestion];
        STATE.currentQuestionIndex = 0;
        STATE.checkinAnswers = [];

        renderCurrentQuestion();

        const buttonStack = documentInstance.getElementById('button-stack');
        expect(buttonStack).not.toBeNull();
        expect(buttonStack.getAttribute('aria-label')).toBe('Select Yes or No');

        const buttons = buttonStack.querySelectorAll('.score-button');
        expect(buttons.length).toBe(2);

        const yesButton = buttonStack.querySelector('.score-button[data-boolean="yes"]');
        const noButton = buttonStack.querySelector('.score-button[data-boolean="no"]');
        expect(yesButton).not.toBeNull();
        expect(noButton).not.toBeNull();

        const inputBox = documentInstance.getElementById('input-box');
        expect(inputBox.getAttribute('data-response-type')).toBe('boolean');
    });

    it('submits BOOLEAN_YES_SCORE (5) to handleScoreSubmission and answers array when clicking Yes', async () => {
        const eatenQuestion = DEFAULT_QUESTIONS.find(question => question.id === 'q_eaten');
        STATE.activeQuestions = [eatenQuestion];
        STATE.currentQuestionIndex = 0;
        STATE.checkinAnswers = [];

        renderCurrentQuestion();

        const yesButton = documentInstance.querySelector('#button-stack .score-button[data-boolean="yes"]');
        yesButton.click();

        expect(STATE.checkinAnswers.length).toBe(1);
        expect(STATE.checkinAnswers[0]).toEqual({
            questionId: 'q_eaten',
            score: BOOLEAN_YES_SCORE,
            status: 'answered'
        });
    });

    it('submits BOOLEAN_NO_SCORE (1) to handleScoreSubmission and answers array when clicking No', async () => {
        const eatenQuestion = DEFAULT_QUESTIONS.find(question => question.id === 'q_eaten');
        STATE.activeQuestions = [eatenQuestion];
        STATE.currentQuestionIndex = 0;
        STATE.checkinAnswers = [];

        renderCurrentQuestion();

        const noButton = documentInstance.querySelector('#button-stack .score-button[data-boolean="no"]');
        noButton.click();

        expect(STATE.checkinAnswers.length).toBe(1);
        expect(STATE.checkinAnswers[0]).toEqual({
            questionId: 'q_eaten',
            score: BOOLEAN_NO_SCORE,
            status: 'answered'
        });
    });
});

describe('Boolean Line Rendering — Step Interpolation', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
    });

    it('produces horizontal-then-vertical step for boolean series in renderGraphSVG', () => {
        const booleanQuestion = createSampleBooleanQuestion({ text: 'Eaten today?' });
        const entries = createSampleBooleanEntries([5, 1]);

        const { layout, container } = renderGraphToContainer(windowInstance, documentInstance, {
            entries,
            questions: [booleanQuestion]
        });

        const pathElement = container.querySelector('svg g.lines path');
        expect(pathElement).not.toBeNull();

        const pathData = pathElement.getAttribute('d');
        const points = layout.series[0].points;
        expect(points.length).toBe(2);
        const p0 = points[0];
        const p1 = points[1];

        // Expected step path: M x0 y0 L x1 y0 L x1 y1
        const expectedStepPath = `M ${p0.x} ${p0.y} L ${p1.x} ${p0.y} L ${p1.x} ${p1.y}`;
        expect(pathData).toBe(expectedStepPath);
    });

    it('produces straight diagonal lines for scale series in renderGraphSVG', () => {
        const scaleQuestion = createSampleScaleQuestion();
        const entries = createSampleBooleanEntries([5, 1], 'scale_q');

        const { layout, container } = renderGraphToContainer(windowInstance, documentInstance, {
            entries,
            questions: [scaleQuestion]
        });

        const pathElement = container.querySelector('svg g.lines path');
        expect(pathElement).not.toBeNull();

        const pathData = pathElement.getAttribute('d');
        const points = layout.series[0].points;
        const p0 = points[0];
        const p1 = points[1];

        // Expected scale path: straight diagonal M x0 y0 L x1 y1 (no intermediate L x1 y0)
        const expectedStraightPath = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
        expect(pathData).toBe(expectedStraightPath);
    });

    it('steps across alternating Yes/No answers in multi-point boolean series', () => {
        const booleanQuestion = createSampleBooleanQuestion({ text: 'Eaten' });
        const entries = createSampleBooleanEntries([5, 1, 5]);

        const { layout, container } = renderGraphToContainer(windowInstance, documentInstance, {
            entries,
            questions: [booleanQuestion]
        });

        const pathElement = container.querySelector('svg g.lines path');
        const pathData = pathElement.getAttribute('d');
        const [p0, p1, p2] = layout.series[0].points;

        const expectedPath =
            `M ${p0.x} ${p0.y} L ${p1.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p1.y} L ${p2.x} ${p2.y}`;
        expect(pathData).toBe(expectedPath);
    });
});

describe('Boolean Point Tooltips & Accessible Labels', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        windowInstance = setup.window;
        documentInstance = setup.document;
    });

    it('renders "Yes" for BOOLEAN_YES_SCORE in aria-label and <title> on boolean points', () => {
        const booleanQuestion = createSampleBooleanQuestion();
        const entries = createSampleBooleanEntries([BOOLEAN_YES_SCORE]);

        const { container } = renderGraphToContainer(windowInstance, documentInstance, {
            entries,
            questions: [booleanQuestion]
        });

        const circle = container.querySelector('svg g.points circle');
        expect(circle).not.toBeNull();

        const ariaLabel = circle.getAttribute('aria-label');
        const titleText = circle.querySelector('title').textContent;

        expect(ariaLabel).toContain('Eaten: Yes');
        expect(ariaLabel).not.toContain('Score 5');
        expect(titleText).toContain('Eaten: Yes');
        expect(titleText).not.toContain('Score 5/5');
    });

    it('renders "No" for BOOLEAN_NO_SCORE in aria-label and <title> on boolean points', () => {
        const booleanQuestion = createSampleBooleanQuestion();
        const entries = createSampleBooleanEntries([BOOLEAN_NO_SCORE]);

        const { container } = renderGraphToContainer(windowInstance, documentInstance, {
            entries,
            questions: [booleanQuestion]
        });

        const circle = container.querySelector('svg g.points circle');
        expect(circle).not.toBeNull();

        const ariaLabel = circle.getAttribute('aria-label');
        const titleText = circle.querySelector('title').textContent;

        expect(ariaLabel).toContain('Eaten: No');
        expect(ariaLabel).not.toContain('Score 1');
        expect(titleText).toContain('Eaten: No');
        expect(titleText).not.toContain('Score 1/5');
    });

    it('retains "Score X/5" in <title> and "Score X" in aria-label unchanged on scale points', () => {
        const scaleQuestion = createSampleScaleQuestion();
        const entries = createSampleBooleanEntries([3], 'scale_q');

        const { container } = renderGraphToContainer(windowInstance, documentInstance, {
            entries,
            questions: [scaleQuestion]
        });

        const circle = container.querySelector('svg g.points circle');
        expect(circle).not.toBeNull();

        const ariaLabel = circle.getAttribute('aria-label');
        const titleText = circle.querySelector('title').textContent;

        expect(ariaLabel).toContain('Mood: Score 3');
        expect(titleText).toContain('Mood: Score 3/5');
    });
});
