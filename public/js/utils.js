/**
 * HIGH & LOW - SHARED UTILITIES
 * Small, dependency-free helper functions used across modules.
 */

export function escapeHTML(stringToEscape) {
    if (!stringToEscape) return '';
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