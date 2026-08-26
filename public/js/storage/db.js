/**
 * HIGH & LOW - INDEXEDDB LOCAL VAULT STRUCT
 * Promise wrappers over the raw IndexedDB request API.
 */

let db = null;
export const DB_NAME = 'HighAndLowDB';
export const DB_VERSION = 3;

export function getDatabase() {
    return db;
}

export function initDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB is not supported in this environment."));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const upgradeDb = event.target.result;
            const transaction = event.target.transaction;
            if (!upgradeDb.objectStoreNames.contains('config')) {
                upgradeDb.createObjectStore('config', { keyPath: 'key' });
            }
            if (!upgradeDb.objectStoreNames.contains('entries')) {
                const entriesStore = upgradeDb.createObjectStore('entries', { keyPath: 'timestamp' });
                // If an older 'logs' object store existed from earlier prototypes, migrate its records
                if (upgradeDb.objectStoreNames.contains('logs') && transaction) {
                    try {
                        const oldLogsStore = transaction.objectStore('logs');
                        oldLogsStore.openCursor().onsuccess = (cursorEvent) => {
                            const cursor = cursorEvent.target.result;
                            if (cursor) {
                                entriesStore.put(cursor.value);
                                cursor.continue();
                            }
                        };
                    } catch (migrationError) {
                        console.warn('Could not migrate legacy logs store:', migrationError);
                    }
                }
            }
            if (!upgradeDb.objectStoreNames.contains('questions')) {
                upgradeDb.createObjectStore('questions', { keyPath: 'id' });
            }
        };
    });
}

export function getAll(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export function put(storeName, item) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction([storeName], 'readwrite');
        transaction.objectStore(storeName).put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export function getConfig(key) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve(undefined);
        const request = db.transaction(['config'], 'readonly').objectStore('config').get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
        request.onerror = () => reject(request.error);
    });
}

export function setConfig(key, value) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction(['config'], 'readwrite');
        transaction.objectStore('config').put({ key, value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export function deleteConfig(key) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction(['config'], 'readwrite');
        transaction.objectStore('config').delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}