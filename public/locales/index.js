/**
 * HIGH & LOW - LOCALES REGISTRY
 * Imports all drop-in locale modules and registers them into the central dictionary.
 */

import en from './en.js';

export const LOCALES = {
    en
};

export const SUPPORTED_LANGUAGES = Object.keys(LOCALES);
export const DEFAULT_LANGUAGE = 'en';

/**
 * Returns available language options for settings UI.
 * @returns {Array<{ code: string, name: string, direction: string }>}
 */
export function getAvailableLocales() {
    return Object.entries(LOCALES).map(([code, localeData]) => ({
        code,
        name: localeData.metadata?.name || code,
        direction: localeData.metadata?.direction || 'ltr'
    }));
}
