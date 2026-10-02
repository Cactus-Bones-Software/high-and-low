/**
 * HIGH & LOW - INDEXEDDB LOCAL VAULT STRUCT
 * Promise wrappers over the raw IndexedDB request API.
 */

let databaseInstance = null;
export const DB_NAME = 'HighAndLowDB';
export const DB_VERSION = 3;

/**
 * Returns the currently initialized IndexedDB database instance.
 * @returns {IDBDatabase | null} The active IDBDatabase connection, or null if not yet opened.
 */
export function getDatabase() {
    return databaseInstance;
}

/**
 * Opens or upgrades the HighAndLowDB IndexedDB database.
 * Sets up object stores ('config', 'entries', 'questions') and migrates legacy stores if present.
 * @returns {Promise<IDBDatabase>} Resolves with the opened database instance.
 */
export function initDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB is not supported in this environment."));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            databaseInstance = request.result;
            resolve(databaseInstance);
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

/**
 * Fetches a single record by primary key from the specified object store.
 * @param {string} storeName - Name of the object store ('config', 'entries', 'questions').
 * @param {IDBValidKey} key - Primary key of the record to retrieve.
 * @returns {Promise<any>} Resolves with the record, or undefined if not found or database not initialized.
 */
export function get(storeName, key) {
    return new Promise((resolve, reject) => {
        if (!databaseInstance) return resolve(undefined);
        const request = databaseInstance.transaction([storeName], 'readonly').objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Fetches all records from the specified object store.
 * @param {string} storeName - Name of the object store to query.
 * @returns {Promise<any[]>} Resolves with an array of all records found, or empty array.
 */
export function getAll(storeName) {
    return new Promise((resolve, reject) => {
        if (!databaseInstance) return resolve([]);
        const request = databaseInstance.transaction([storeName], 'readonly').objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Inserts or updates a record in the specified object store.
 * @param {string} storeName - Name of the target object store.
 * @param {any} item - Object payload to store.
 * @returns {Promise<void>} Resolves when the write transaction completes.
 */
export function put(storeName, item) {
    return new Promise((resolve, reject) => {
        if (!databaseInstance) return resolve();
        const transaction = databaseInstance.transaction([storeName], 'readwrite');
        transaction.objectStore(storeName).put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

/**
 * Retrieves a configuration value by key from the 'config' object store.
 * @param {string} key - Configuration property name.
 * @returns {Promise<any>} Resolves with the configuration value, or undefined if not set.
 */
export function getConfig(key) {
    return new Promise((resolve, reject) => {
        if (!databaseInstance) return resolve(undefined);
        const request = databaseInstance.transaction(['config'], 'readonly').objectStore('config').get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Sets a configuration key/value pair in the 'config' object store.
 * @param {string} key - Configuration property name.
 * @param {any} value - Configuration value to persist.
 * @returns {Promise<void>} Resolves when the write transaction completes.
 */
export function setConfig(key, value) {
    return new Promise((resolve, reject) => {
        if (!databaseInstance) return resolve();
        const transaction = databaseInstance.transaction(['config'], 'readwrite');
        transaction.objectStore('config').put({ key, value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

/**
 * Deletes a configuration entry from the 'config' object store.
 * @param {string} key - Configuration property name to delete.
 * @returns {Promise<void>} Resolves when the delete transaction completes.
 */
export function deleteConfig(key) {
    return new Promise((resolve, reject) => {
        if (!databaseInstance) return resolve();
        const transaction = databaseInstance.transaction(['config'], 'readwrite');
        transaction.objectStore('config').delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
