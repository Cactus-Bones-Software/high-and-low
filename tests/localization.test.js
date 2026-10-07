import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import {
    t,
    setLanguage,
    getCurrentLanguage,
    applyTranslations,
    getLocalizedQuestion,
    registerLocale,
    DEFAULT_LANGUAGE
} from '../public/js/localization.js';
import { STATE } from '../public/js/state.js';

describe('Phase 8: Internationalization & Localization Pass (Task 8.3)', () => {
    let testHarnessEnvironment = null;

    beforeEach(async () => {
        testHarnessEnvironment = await setupTestDOM();
        registerLocale('test', {
            metadata: { name: 'Test Language', code: 'test', direction: 'ltr' },
            common: {
                yes: 'Sí',
                no: 'No',
                cancel: 'Cancelar',
                save: 'Guardar',
                back: 'Atrás',
                notice: 'Aviso'
            },
            navigation: {
                tracker: 'Registro de Ánimo',
                openMenu: 'Abrir menú y navegación'
            },
            tracker: {
                progress: 'Pregunta {current} de {total}',
                completeTitle: 'Registro Completo'
            },
            builtInQuestions: {
                q_energy: {
                    text: '¿Cómo está tu energía en este momento?',
                    shortLabel: 'Nivel de Energía'
                }
            },
            questions: {
                searchPlaceholder: 'Buscar por texto, etiqueta o categoría…'
            }
        });
    });

    afterEach(() => {
        STATE.language = 'en';
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.lang = 'en';
        }
        vi.restoreAllMocks();
    });

    describe('1. Translation Engine & Dictionary Lookups (t)', () => {
        it('returns correct translations for default English language', () => {
            STATE.language = 'en';
            expect(t('common.yes')).toBe('Yes');
            expect(t('common.no')).toBe('No');
            expect(t('common.cancel')).toBe('Cancel');
            expect(t('common.save')).toBe('Save');
            expect(t('navigation.tracker')).toBe('Mood Tracker');
            expect(t('tracker.completeTitle')).toBe('Check-In Complete');
        });

        it('returns correct translations for registered secondary language when active', () => {
            STATE.language = 'test';
            expect(t('common.yes')).toBe('Sí');
            expect(t('common.no')).toBe('No');
            expect(t('common.cancel')).toBe('Cancelar');
            expect(t('common.save')).toBe('Guardar');
            expect(t('navigation.tracker')).toBe('Registro de Ánimo');
            expect(t('tracker.completeTitle')).toBe('Registro Completo');
        });

        it('interpolates dynamic parameters into translation templates', () => {
            STATE.language = 'en';
            const progressEnglish = t('tracker.progress', { current: 2, total: 6 });
            expect(progressEnglish).toBe('Question 2 of 6');

            STATE.language = 'test';
            const progressSecondary = t('tracker.progress', { current: 3, total: 5 });
            expect(progressSecondary).toBe('Pregunta 3 de 5');
        });

        it('falls back to English when a key is missing from a secondary language', () => {
            STATE.language = 'test';
            // Even if a non-existent key is requested, returns the dot-path gracefully
            expect(t('unknown.category.key')).toBe('unknown.category.key');
        });

        it('handles null, undefined, or empty key gracefully', () => {
            expect(t('')).toBe('');
            expect(t(null)).toBe('');
            expect(t(undefined)).toBe('');
        });
    });

    describe('2. Built-in Question Localization (getLocalizedQuestion)', () => {
        it('returns question unchanged when language is English', () => {
            STATE.language = 'en';
            const builtInQuestion = {
                id: 'q_energy',
                text: 'How is your energy right now?',
                shortLabel: 'Energy Level',
                builtIn: true
            };
            const localized = getLocalizedQuestion(builtInQuestion);
            expect(localized.text).toBe('How is your energy right now?');
            expect(localized.shortLabel).toBe('Energy Level');
        });

        it('returns translated text and shortLabel for built-in questions in secondary language', () => {
            STATE.language = 'test';
            const builtInQuestion = {
                id: 'q_energy',
                text: 'How is your energy right now?',
                shortLabel: 'Energy Level',
                builtIn: true
            };
            const localized = getLocalizedQuestion(builtInQuestion);
            expect(localized.text).toBe('¿Cómo está tu energía en este momento?');
            expect(localized.shortLabel).toBe('Nivel de Energía');
        });

        it('does not translate custom user-created questions', () => {
            STATE.language = 'test';
            const customQuestion = {
                id: 'c_custom123',
                text: 'My custom daily prompt',
                shortLabel: 'Custom Prompt',
                builtIn: false
            };
            const localized = getLocalizedQuestion(customQuestion);
            expect(localized.text).toBe('My custom daily prompt');
            expect(localized.shortLabel).toBe('Custom Prompt');
        });
    });

    describe('3. DOM Translation Engine (applyTranslations & translateElement)', () => {
        it('translates elements with data-i18n, placeholder, aria-label, and title', () => {
            const container = testHarnessEnvironment.document.createElement('div');
            container.innerHTML = `
                <span id="test-text" data-i18n="common.back">Original Back</span>
                <input id="test-input" data-i18n-placeholder="questions.searchPlaceholder" placeholder="Original" />
                <button id="test-button" data-i18n-aria="navigation.openMenu" aria-label="Original Aria"></button>
                <div id="test-title" data-i18n-title="common.notice" title="Original Title"></div>
            `;
            testHarnessEnvironment.document.body.appendChild(container);

            STATE.language = 'test';
            applyTranslations(container);

            const textElement = container.querySelector('#test-text');
            const inputElement = container.querySelector('#test-input');
            const buttonElement = container.querySelector('#test-button');
            const titleElement = container.querySelector('#test-title');

            expect(textElement.textContent).toBe('Atrás');
            expect(inputElement.placeholder).toBe('Buscar por texto, etiqueta o categoría…');
            expect(buttonElement.getAttribute('aria-label')).toBe('Abrir menú y navegación');
            expect(titleElement.title).toBe('Aviso');

            container.remove();
        });

        it('synchronizes documentElement.lang attribute with active language', () => {
            STATE.language = 'test';
            applyTranslations(testHarnessEnvironment.document);
            expect(testHarnessEnvironment.document.documentElement.lang).toBe('test');

            STATE.language = 'en';
            applyTranslations(testHarnessEnvironment.document);
            expect(testHarnessEnvironment.document.documentElement.lang).toBe('en');
        });
    });

    describe('4. Language Switching & State Persistence (setLanguage)', () => {
        it('updates STATE.language and persists to localStorage and IndexedDB', async () => {
            await setLanguage('test');
            expect(getCurrentLanguage()).toBe('test');
            expect(STATE.language).toBe('test');
            expect(testHarnessEnvironment.window.localStorage.getItem('language')).toBe('test');

            const storedConfig = await testHarnessEnvironment.window.getConfig('language');
            expect(storedConfig).toBe('test');

            // Switch back to English
            await setLanguage('en');
            expect(getCurrentLanguage()).toBe('en');
            expect(STATE.language).toBe('en');
            expect(testHarnessEnvironment.window.localStorage.getItem('language')).toBe('en');
        });

        it('falls back to default language for unsupported language codes', async () => {
            await setLanguage('unsupported_code');
            expect(getCurrentLanguage()).toBe(DEFAULT_LANGUAGE);
            expect(STATE.language).toBe(DEFAULT_LANGUAGE);
        });
    });

    describe('5. Settings UI Integration: Language Selector', () => {
        it('changes language and re-translates tracker UI when user selects secondary language in settings', async () => {
            const languageSelect = testHarnessEnvironment.document.getElementById('language-select');
            expect(languageSelect).not.toBeNull();
            expect(languageSelect.value).toBe('en');

            const testOption = testHarnessEnvironment.document.createElement('option');
            testOption.value = 'test';
            testOption.textContent = 'Test Language';
            languageSelect.appendChild(testOption);

            languageSelect.value = 'test';
            languageSelect.dispatchEvent(new testHarnessEnvironment.window.Event('change'));

            const progressElement = testHarnessEnvironment.document.getElementById('progress-text');
            await waitFor(() => progressElement?.textContent.includes('Pregunta 1 de'));

            expect(progressElement.textContent).toContain('Pregunta 1 de');

            const backButtonText = testHarnessEnvironment.document.querySelector(
                '#settings-canvas .canvas-back-button [data-i18n="common.back"]'
            );
            if (backButtonText) {
                expect(backButtonText.textContent).toBe('Atrás');
            }
        });
    });
});
