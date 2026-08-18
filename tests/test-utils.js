import { readFileSync } from 'fs';
import { resolve } from 'path';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';

const htmlContent = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const appJsContent = readFileSync(resolve(__dirname, '../app.js'), 'utf8');

/**
 * Checks whether an element is marked as inert either via attribute or property.
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isElementInert(element) {
    return element.hasAttribute('inert') || element.inert === true;
}

/**
 * Async sleep utility for test waiting.
 * @param {number} milliseconds
 * @returns {Promise<void>}
 */
export function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/**
 * Polls until a predicate returns true or timeout expires.
 * @param {() => boolean | Promise<boolean>} predicate
 * @param {number} timeoutMilliseconds
 * @param {number} intervalMilliseconds
 * @returns {Promise<void>}
 */
export async function waitFor(predicate, timeoutMilliseconds = 1500, intervalMilliseconds = 20) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMilliseconds) {
        if (await predicate()) return;
        await sleep(intervalMilliseconds);
    }
}

/**
 * Initializes a clean JSDOM instance with IndexedDB, Storage, and Polyfills.
 * @param {Record<string, string>} [customSessionStorage={}]
 * @returns {Promise<{ dom: JSDOM, window: Window, document: Document }>}
 */
export async function setupTestDOM(customSessionStorage = {}) {
    const domInstance = new JSDOM(htmlContent, {
        url: 'http://localhost:3000',
        runScripts: 'dangerously'
    });
    const windowInstance = domInstance.window;
    const documentInstance = windowInstance.document;

    // Fresh isolated fake indexedDB per test instance
    windowInstance.indexedDB = new IDBFactory();
    windowInstance.IDBKeyRange = IDBKeyRange;

    // Seed custom sessionStorage if specified
    for (const [storageKey, storageValue] of Object.entries(customSessionStorage)) {
        windowInstance.sessionStorage.setItem(storageKey, storageValue);
    }

    // Polyfill matchMedia on window in JSDOM
    windowInstance.matchMedia = windowInstance.matchMedia || function() {
        return {
            matches: false,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {}
        };
    };

    // Polyfill requestAnimationFrame
    windowInstance.requestAnimationFrame = windowInstance.requestAnimationFrame || function(callback) {
        return setTimeout(callback, 0);
    };
    windowInstance.cancelAnimationFrame = windowInstance.cancelAnimationFrame || function(identifier) {
        clearTimeout(identifier);
    };

    // Polyfill navigator.serviceWorker
    if (!windowInstance.navigator.serviceWorker) {
        Object.defineProperty(windowInstance.navigator, 'serviceWorker', {
            value: { register: async () => {} },
            writable: true,
            configurable: true
        });
    }

    // Evaluate app.js directly in JSDOM window context
    windowInstance.eval(appJsContent);

    // Dispatch DOMContentLoaded on JSDOM window document
    windowInstance.document.dispatchEvent(new windowInstance.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));

    // Wait deterministically for async initDatabase promise chain to complete
    await waitFor(() => Boolean(windowInstance.STATE && windowInstance.STATE.activeQuestions && windowInstance.STATE.activeQuestions.length > 0));

    return {
        dom: domInstance,
        win: windowInstance,
        doc: documentInstance,
        window: windowInstance,
        document: documentInstance
    };
}
