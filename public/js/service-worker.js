// High & Low - Legacy Service Worker entry point
// Delegates to canonical root service worker (../sw.js)
try {
    importScripts('../sw.js');
} catch (error) {
    console.warn('Failed to import ../sw.js in legacy service-worker.js location:', error);
}
