/**
 * HIGH & LOW - SHARED UTILITIES
 * Small, dependency-free helper functions used across modules.
 */

/**
 * Escapes unsafe HTML characters (&, <, >, ", ') in a string to prevent XSS vulnerabilities.
 * @param {any} stringToEscape - Input value or string to sanitize.
 * @returns {string} Safe HTML-escaped string, or empty string if null/undefined.
 */
export function escapeHTML(stringToEscape) {
    if (stringToEscape === null || stringToEscape === undefined) return '';
    return String(stringToEscape)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Safely invokes requestAnimationFrame in browser environments, with a setTimeout fallback
 * for headless testing or non-browser execution contexts.
 * @param {FrameRequestCallback} callback - Function to execute on the next animation frame.
 * @returns {number} Request ID identifier.
 */
export function safeRAF(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame(callback);
    }
    if (typeof requestAnimationFrame === 'function') {
        return requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16);
}

/**
 * Tagged template literal helper that automatically escapes interpolated expressions.
 * Use rawHTML() when an interpolated expression already contains safe, pre-rendered markup.
 * @param {TemplateStringsArray} strings - Template literal string parts.
 * @param {...any} values - Interpolated values to sanitize or inject.
 * @returns {string} Composed safe HTML string.
 */
export function html(strings, ...values) {
    let result = '';
    for (let index = 0; index < strings.length; index++) {
        result += strings[index];
        if (index < values.length) {
            const value = values[index];
            if (value && typeof value === 'object' && value.__isRawHTML) {
                result += value.content;
            } else if (Array.isArray(value)) {
                result += value.map(item => {
                    return (item && typeof item === 'object' && item.__isRawHTML) ? item.content : escapeHTML(item);
                }).join('');
            } else {
                result += escapeHTML(value);
            }
        }
    }
    return result;
}

/**
 * Wraps pre-escaped or trusted HTML markup in a marker object so html`` template literals
 * inject it raw without double-escaping.
 * @param {string | null | undefined} htmlString - Trusted HTML markup string.
 * @returns {{ __isRawHTML: boolean, content: string }} Object marked for raw injection.
 */
export function rawHTML(htmlString) {
    return {
        __isRawHTML: true,
        content: htmlString === null || htmlString === undefined ? '' : String(htmlString)
    };
}
