/**
 * HIGH & LOW - INTERNATIONALIZATION & LOCALIZATION
 * Centralized translation manager, drop-in locale registry, and DOM translation engine.
 */

import { STATE } from './state.js';
import { setConfig } from './storage/db.js';

export const DEFAULT_LANGUAGE = 'en';
const LOCALES_DIRECTORY = './locales/';
const MANIFEST_URL = `${LOCALES_DIRECTORY}manifest.json`;

/**
 * Language codes the app may switch to. Always contains the default language; extended by the manifest.
 * @type {string[]}
 */
export const SUPPORTED_LANGUAGES = [DEFAULT_LANGUAGE];

/**
 * Language options for the settings menu, as listed in locales/manifest.json.
 * @type {Array<{ code: string, name: string, direction: string }>}
 */
const AVAILABLE_LOCALES = [{ code: DEFAULT_LANGUAGE, name: 'English', direction: 'ltr' }];

/**
 * In-memory translation dictionaries keyed by language code. Filled at runtime from locales/<code>.json.
 * @type {Record<string, Record<string, any>>}
 */
export const TRANSLATIONS = {};

/**
 * Returns available language options for the settings UI.
 * @returns {Array<{ code: string, name: string, direction: string }>}
 */
export function getAvailableLocales() {
    return AVAILABLE_LOCALES;
}

/**
 * Registers a translation dictionary for a language code and makes the language selectable.
 * @param {string} languageCode - Language code (e.g. 'fr', 'de').
 * @param {Record<string, any>} localeData - Complete or partial locale translations object.
 * @returns {void}
 */
export function registerLocale(languageCode, localeData) {
    if (!languageCode || typeof languageCode !== 'string' || !localeData) return;
    TRANSLATIONS[languageCode] = localeData;
    if (!SUPPORTED_LANGUAGES.includes(languageCode)) {
        SUPPORTED_LANGUAGES.push(languageCode);
    }
}

/**
 * Fetches locales/manifest.json and records which languages are available. On failure only the
 * default language remains available.
 * @param {string} [manifestUrl] - Path to the manifest file.
 * @returns {Promise<Array<{ code: string, name: string, direction: string }>>}
 */
export async function loadManifest(manifestUrl = MANIFEST_URL) {
    try {
        const response = await fetch(manifestUrl);
        if (response.ok) {
            const manifest = await response.json();
            (manifest.locales || []).forEach(({ code, name, direction }) => {
                if (!code || typeof code !== 'string') return;
                if (!SUPPORTED_LANGUAGES.includes(code)) SUPPORTED_LANGUAGES.push(code);
                const entry = { code, name: name || code, direction: direction || 'ltr' };
                const existingIndex = AVAILABLE_LOCALES.findIndex((locale) => locale.code === code);
                if (existingIndex === -1) AVAILABLE_LOCALES.push(entry);
                else AVAILABLE_LOCALES[existingIndex] = entry;
            });
        }
    } catch (fetchError) {
        console.warn('Could not load locale manifest:', fetchError);
    }
    return AVAILABLE_LOCALES;
}

/**
 * Loads a locale's translations from locales/<code>.json unless it is already in memory.
 * @param {string} languageCode - Language code to load (e.g. 'de', 'fr').
 * @param {string} [jsonUrl] - Path to the locale JSON file.
 * @returns {Promise<Record<string, any> | null>} The dictionary, or null if it could not be loaded.
 */
export async function loadLocale(languageCode, jsonUrl = `${LOCALES_DIRECTORY}${languageCode}.json`) {
    if (TRANSLATIONS[languageCode]) return TRANSLATIONS[languageCode];
    try {
        const response = await fetch(jsonUrl);
        if (response.ok) {
            const localeData = await response.json();
            registerLocale(languageCode, localeData);
            return localeData;
        }
    } catch (fetchError) {
        console.warn(`Could not load locale ${languageCode}:`, fetchError);
    }
    return null;
}

/**
 * Populates the language selector dropdown with every locale listed in the manifest.
 * @returns {void}
 */
export function populateLanguageOptions() {
    if (typeof document === 'undefined') return;
    const languageSelect = document.getElementById('language-select');
    if (!languageSelect) return;
    getAvailableLocales().forEach(({ code, name }) => {
        let option = languageSelect.querySelector(`option[value="${code}"]`);
        if (!option) {
            option = document.createElement('option');
            option.value = code;
            option.textContent = name;
            languageSelect.appendChild(option);
        }
    });
}

/**
 * Returns a question object with text and shortLabel translated if it is a built-in question
 * and a translation exists for the current language.
 * @param {Object} question - The question definition object.
 * @returns {Object} Localized copy of the question definition.
 */
export function getLocalizedQuestion(question) {
    if (!question) return question;
    const currentLanguage = getCurrentLanguage();
    if (question.builtIn && TRANSLATIONS[currentLanguage]?.builtInQuestions?.[question.id]) {
        const localized = TRANSLATIONS[currentLanguage].builtInQuestions[question.id];
        return {
            ...question,
            text: localized.text || question.text,
            shortLabel: localized.shortLabel || question.shortLabel
        };
    }
    return question;
}

/**
 * Returns the currently active language code.
 * @returns {string} Language code (e.g. 'en', 'es').
 */
export function getCurrentLanguage() {
    return STATE.language || DEFAULT_LANGUAGE;
}

/**
 * Translates a dot-notated key path for the active language with optional parameter interpolation.
 * Falls back to the default language ('en') if a key is missing.
 * @param {string} keyPath - Dot-separated translation key (e.g. 'tracker.progress').
 * @param {Record<string, any>} [parameters={}] - Dynamic parameters to interpolate (e.g. { current: 1, total: 5 }).
 * @returns {string} Localized string, or keyPath if translation not found.
 */
export function t(keyPath, parameters = {}) {
    if (!keyPath || typeof keyPath !== 'string') return '';
    const currentLanguage = getCurrentLanguage();
    const keys = keyPath.split('.');

    let translation = resolveKeyPath(TRANSLATIONS[currentLanguage], keys);
    if (translation === undefined && currentLanguage !== DEFAULT_LANGUAGE) {
        translation = resolveKeyPath(TRANSLATIONS[DEFAULT_LANGUAGE], keys);
    }
    if (translation === undefined) {
        return keyPath;
    }

    if (typeof translation !== 'string') {
        return translation;
    }

    return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return parameters[paramKey] !== undefined ? String(parameters[paramKey]) : match;
    });
}

function resolveKeyPath(objectReference, keysArray) {
    let currentScope = objectReference;
    for (const key of keysArray) {
        if (!currentScope || typeof currentScope !== 'object') return undefined;
        currentScope = currentScope[key];
    }
    return currentScope;
}

/**
 * Translates a single DOM element based on its data-i18n* attributes.
 * @param {HTMLElement} targetElement - DOM element to translate.
 * @returns {void}
 */
export function translateElement(targetElement) {
    if (!targetElement) return;

    const textKey = targetElement.getAttribute('data-i18n');
    if (textKey) {
        const translated = t(textKey);
        if (typeof translated === 'string') {
            targetElement.textContent = translated;
        }
    }

    const placeholderKey = targetElement.getAttribute('data-i18n-placeholder');
    if (placeholderKey && 'placeholder' in targetElement) {
        targetElement.placeholder = t(placeholderKey);
    }

    const ariaKey = targetElement.getAttribute('data-i18n-aria');
    if (ariaKey) {
        targetElement.setAttribute('aria-label', t(ariaKey));
    }

    const titleKey = targetElement.getAttribute('data-i18n-title');
    if (titleKey) {
        targetElement.title = t(titleKey);
    }
}

/**
 * Translates all DOM elements containing data-i18n* attributes within a root element.
 * @param {Document | HTMLElement} [rootElement=document] - Container element to search.
 * @returns {void}
 */
export function applyTranslations(rootElement = typeof document !== 'undefined' ? document : null) {
    if (!rootElement) return;

    const selector = '[data-i18n], [data-i18n-placeholder], [data-i18n-aria], [data-i18n-title]';
    const elementsToTranslate = rootElement.querySelectorAll(selector);
    elementsToTranslate.forEach(translateElement);

    if (rootElement.hasAttribute && rootElement.matches(selector)) {
        translateElement(rootElement);
    }

    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.lang = getCurrentLanguage();
    }
}

/**
 * Sets the active application language, persists it to storage, updates STATE,
 * updates form selectors, and re-translates the UI.
 * Loads the language (and the default-language fallback) first; if loading fails, uses the default.
 * @param {string} languageCode - Language code listed in locales/manifest.json.
 * @returns {Promise<void>}
 */
export async function setLanguage(languageCode) {
    let validatedLanguage = SUPPORTED_LANGUAGES.includes(languageCode) ? languageCode : DEFAULT_LANGUAGE;
    await loadLocale(DEFAULT_LANGUAGE);
    if (validatedLanguage !== DEFAULT_LANGUAGE && !(await loadLocale(validatedLanguage))) {
        validatedLanguage = DEFAULT_LANGUAGE;
    }
    STATE.language = validatedLanguage;

    try {
        localStorage.setItem('language', validatedLanguage);
    } catch (storageError) {
        console.warn('Failed to persist language in localStorage:', storageError);
    }

    try {
        await setConfig('language', validatedLanguage);
    } catch (databaseError) {
        console.warn('Failed to persist language in IndexedDB config:', databaseError);
    }

    applyTranslations();

    if (typeof document !== 'undefined') {
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) languageSelect.value = validatedLanguage;
    }
}