/**
 * HIGH & LOW - SHARED UTILITIES
 * Small, dependency-free helper functions used across modules.
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

export function rawHTML(htmlString) {
    return {
        __isRawHTML: true,
        content: htmlString === null || htmlString === undefined ? '' : String(htmlString)
    };
}
