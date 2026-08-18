import { readFileSync } from 'fs';
import { resolve } from 'path';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';

const htmlContent = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const appJsContent = readFileSync(resolve(__dirname, '../app.js'), 'utf8');

/**
 * Checks whether an element is marked as inert either via attribute or property.
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isElementInert(el) {
    return el.hasAttribute('inert') || el.inert === true;
}

/**
 * Async sleep utility for test waiting.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

/**
 * Polls until a predicate returns true or timeout expires.
 * @param {() => boolean | Promise<boolean>} predicate
 * @param {number} timeoutMs
 * @param {number} intervalMs
 * @returns {Promise<void>}
 */
export async function waitFor(predicate, timeoutMs = 1500, intervalMs = 20) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (await predicate()) return;
        await sleep(intervalMs);
    }
}

/**
 * Initializes a clean JSDOM instance with IndexedDB, Storage, and Polyfills.
 * @param {Record<string, string>} [customSessionStorage={}]
 * @returns {Promise<{ dom: JSDOM, win: Window, doc: Document }>}
 */
export async function setupTestDOM(customSessionStorage = {}) {
    const dom = new JSDOM(htmlContent, {
        url: 'http://localhost:3000',
        runScripts: 'dangerously'
    });
    const win = dom.window;
    const doc = win.document;

    // Fresh isolated fake indexedDB per test instance
    win.indexedDB = new IDBFactory();
    win.IDBKeyRange = IDBKeyRange;

    // Seed custom sessionStorage if specified
    for (const [k, v] of Object.entries(customSessionStorage)) {
        win.sessionStorage.setItem(k, v);
    }

    // Polyfill matchMedia on window in JSDOM
    win.matchMedia = win.matchMedia || function() {
        return {
            matches: false,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {}
        };
    };

    // Polyfill requestAnimationFrame
    win.requestAnimationFrame = win.requestAnimationFrame || function(cb) {
        return setTimeout(cb, 0);
    };
    win.cancelAnimationFrame = win.cancelAnimationFrame || function(id) {
        clearTimeout(id);
    };

    // Polyfill navigator.serviceWorker
    if (!win.navigator.serviceWorker) {
        Object.defineProperty(win.navigator, 'serviceWorker', {
            value: { register: async () => {} },
            writable: true,
            configurable: true
        });
    }

    // Evaluate app.js directly in JSDOM window context
    win.eval(appJsContent);

    // Dispatch DOMContentLoaded on JSDOM window document
    win.document.dispatchEvent(new win.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));

    // Wait deterministically for async initDatabase promise chain to complete
    await waitFor(() => Boolean(win.STATE && win.STATE.activeQuestions && win.STATE.activeQuestions.length > 0));

    return { dom, win, doc };
}
