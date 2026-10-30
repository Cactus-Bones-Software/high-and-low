import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import { DEFAULT_QUESTIONS, createCustomQuestion } from '../public/js/questions.js';
import { getAll, put } from '../public/js/storage/db.js';
import { buildScoreButtonsHTML } from '../public/js/checkin.js';
import { escapeHTML, html, rawHTML } from '../public/js/utils.js';

describe('Question Schema & Default Tags', () => {
    let _windowInstance;
    let _documentInstance;

    beforeEach(async () => {
        const setup = await setupTestDOM();
        _windowInstance = setup.window;
        _documentInstance = setup.document;
        // Wait for IndexedDB initialization and seeding
        await waitFor(() => getAll && typeof getAll === 'function');
    });

    it('includes non-empty tags array for all built-in questions in DEFAULT_QUESTIONS', () => {
        const defaultQuestions = DEFAULT_QUESTIONS;
        expect(Array.isArray(defaultQuestions)).toBe(true);
        expect(defaultQuestions.length).toBe(8);

        defaultQuestions.forEach(question => {
            expect(Array.isArray(question.tags)).toBe(true);
            expect(question.tags.length).toBeGreaterThan(0);
            question.tags.forEach(tag => {
                expect(typeof tag).toBe('string');
                expect(tag.trim().length).toBeGreaterThan(0);
            });
        });

        // Verify specific key default tags for core questions
        const energyQuestion = defaultQuestions.find(question => question.id === 'q_energy');
        expect(energyQuestion.tags).toEqual(['Energy', 'Somatic']);

        const sadnessQuestion = defaultQuestions.find(question => question.id === 'q_sadness');
        expect(sadnessQuestion.tags).toEqual(['Mood', 'Affect']);

        const overallQuestion = defaultQuestions.find(question => question.id === 'q_overall');
        expect(overallQuestion.tags).toEqual(['Mood', 'Core']);

        const eatenQuestion = defaultQuestions.find(question => question.id === 'q_eaten');
        expect(eatenQuestion.tags).toEqual(['Somatic', 'Physical']);
    });

    it('contains tags array for seeded questions in IndexedDB questions store', async () => {
        const questionsInStore = await getAll('questions');
        expect(questionsInStore.length).toBe(8);

        questionsInStore.forEach(question => {
            expect(Array.isArray(question.tags)).toBe(true);
            expect(question.tags.length).toBeGreaterThan(0);
        });

        const energyInDb = questionsInStore.find(question => question.id === 'q_energy');
        expect(energyInDb.tags).toContain('Energy');
        expect(energyInDb.tags).toContain('Somatic');
    });

    it('persists tags array correctly to IndexedDB in createCustomQuestion', async () => {
        const customQuestionOutcome = await createCustomQuestion({
            text: 'How well did you sleep last night?',
            shortLabel: 'Sleep Quality',
            tags: ['Sleep', 'Rest', 'Physical'],
            curve: 'more-is-better',
            minLabel: 'Poor / Restless',
            maxLabel: 'Deep & Restful',
            addToSet: false
        });

        expect(customQuestionOutcome.status).toBe('added');
        expect(Array.isArray(customQuestionOutcome.question.tags)).toBe(true);
        expect(customQuestionOutcome.question.tags).toEqual(['Sleep', 'Rest', 'Physical']);

        // Verify it was persisted to IndexedDB questions store
        const questionsInStore = await getAll('questions');
        const retrievedCustom = questionsInStore.find(question => question.id === customQuestionOutcome.id);
        expect(retrievedCustom).toBeDefined();
        expect(retrievedCustom.tags).toEqual(['Sleep', 'Rest', 'Physical']);
    });

    it('normalizes comma-separated string tags and defaults missing tags to empty array in createCustomQuestion', async () => {
        // Test comma-separated string tags
        const stringTagsOutcome = await createCustomQuestion({
            text: 'How focused is your attention right now?',
            shortLabel: 'Focus Level',
            tags: 'Focus, Attention, Cognitive',
            curve: 'more-is-better',
            addToSet: false
        });

        expect(stringTagsOutcome.question.tags).toEqual(['Focus', 'Attention', 'Cognitive']);

        // Test undefined tags defaults to empty array
        const emptyTagsOutcome = await createCustomQuestion({
            text: 'Are you feeling social today?',
            shortLabel: 'Sociability',
            curve: 'more-is-better',
            addToSet: false
        });

        expect(Array.isArray(emptyTagsOutcome.question.tags)).toBe(true);
        expect(emptyTagsOutcome.question.tags).toEqual([]);
    });

    it('updates pre-existing legacy questions missing tags when seeding', async () => {
        // Manually put a question without tags in the store
        const legacyQuestion = {
            id: 'q_racing',
            text: 'How fast are your thoughts moving?',
            shortLabel: 'Racing Thoughts',
            curve: 'less-is-better',
            minLabel: 'Quiet & Focused',
            maxLabel: 'Unstoppable Racing',
            midLabel: null,
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
            // Notice: tags property is omitted
        };
        await put('questions', legacyQuestion);

        // Run seedDefaults again
        const allQuestionsBefore = await getAll('questions');
        const racingBefore = allQuestionsBefore.find(q => q.id === 'q_racing');
        expect(racingBefore.tags).toBeUndefined();

        // Seed / upgrade
        const defaultRacing = DEFAULT_QUESTIONS.find(q => q.id === 'q_racing');
        await put('questions', {
            ...racingBefore,
            tags: defaultRacing.tags
        });

        const allQuestionsAfter = await getAll('questions');
        const racingAfter = allQuestionsAfter.find(q => q.id === 'q_racing');
        expect(racingAfter.tags).toEqual(['Cognitive', 'Pacing']);
    });

    it('escapes malicious label strings in innerHTML in buildScoreButtonsHTML', () => {
        // This is malicious HTML, WebStorm. It's going to be malformed, for good reason.
        // noinspection HtmlRequiredAltAttribute,HtmlUnknownTarget,HtmlDeprecatedAttribute
        const maliciousQuestion = {
            id: 'q_test_xss',
            curve: 'middle-is-best',
            minLabel: '<img src=x onerror=alert(1)> "Min & Low"',
            maxLabel: '<script>alert(2)</script> & "High"',
            midLabel: '<b>Balanced & Safe</b>'
        };
        const buttonsHTML = buildScoreButtonsHTML(maliciousQuestion);
        // Ditto for this stuff too.
        // noinspection HtmlRequiredAltAttribute,HtmlUnknownTarget,HtmlDeprecatedAttribute
        expect(buttonsHTML).not.toContain('<img src=x onerror=alert(1)>');
        expect(buttonsHTML).not.toContain('<script>');
        expect(buttonsHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(buttonsHTML).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
        expect(buttonsHTML).toContain('&amp; &quot;High&quot;');
        expect(buttonsHTML).toContain('&lt;b&gt;Balanced &amp; Safe&lt;/b&gt;');
    });

    it('sanitizes interpolated expressions in escapeHTML and html template helper', () => {
        expect(escapeHTML(null)).toBe('');
        expect(escapeHTML(undefined)).toBe('');
        expect(escapeHTML(0)).toBe('0');
        expect(escapeHTML('Tom & Jerry <cartoon> "classic"')).toBe('Tom &amp; Jerry &lt;cartoon&gt; &quot;classic&quot;');

        const unsafeUserText = '<script>bad()</script>';
        const safeMarkup = rawHTML('<span class="safe">Safe</span>');
        const rendered = html`<div class="test">${unsafeUserText} - ${safeMarkup}</div>`;

        expect(rendered).toContain('&lt;script&gt;bad()&lt;/script&gt;');
        expect(rendered).toContain('<span class="safe">Safe</span>');
    });
});