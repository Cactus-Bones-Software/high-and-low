/**
 * HIGH & LOW - SESSION PERSISTENCE
 * sessionStorage-backed persistence for an in-progress check-in and the
 * last active view, so a reload or accidental navigation doesn't lose state.
 */

import { STATE } from '../state.js';

export const CHECKIN_STORAGE_KEY = 'high_and_low_active_checkin';
export const VIEW_STORAGE_KEY = 'high_and_low_active_view';
export const CHECKIN_TIMEOUT_MS = 30 * 60 * 1000; // 30-minute timeout for stale check-ins

/**
 * Persists the current in-progress check-in state to sessionStorage.
 * Stores question index, answers array, custom note, and updated timestamp.
 * @returns {void}
 */
export function saveActiveCheckin() {
    try {
        const payload = {
            currentQuestionIndex: STATE.currentQuestionIndex,
            checkinAnswers: STATE.checkinAnswers,
            checkinNote: STATE.checkinNote,
            updatedAt: Date.now()
        };
        sessionStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to save active check-in state to sessionStorage:', error);
    }
}

/**
 * Removes any saved in-progress check-in from sessionStorage.
 * @returns {void}
 */
export function clearActiveCheckin() {
    try {
        sessionStorage.removeItem(CHECKIN_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to clear active check-in state from sessionStorage:', error);
    }
}

/**
 * Restores an in-progress check-in from sessionStorage if not expired (>30 minutes).
 * Populates STATE.currentQuestionIndex, STATE.checkinAnswers, and STATE.checkinNote.
 * @returns {boolean} True if an unexpired check-in was successfully restored, false otherwise.
 */
export function restoreActiveCheckin() {
    try {
        const rawCheckin = sessionStorage.getItem(CHECKIN_STORAGE_KEY);
        if (!rawCheckin) return false;
        const parsedCheckin = JSON.parse(rawCheckin);
        if (parsedCheckin && typeof parsedCheckin.currentQuestionIndex === 'number' &&
            Array.isArray(parsedCheckin.checkinAnswers)) {
            // Expire if inactive for > 30 minutes
            if (typeof parsedCheckin.updatedAt === 'number') {
                const elapsedMilliseconds = Date.now() - parsedCheckin.updatedAt;
                if (elapsedMilliseconds > CHECKIN_TIMEOUT_MS) {
                    clearActiveCheckin();
                    return false;
                }
            }
            STATE.currentQuestionIndex = parsedCheckin.currentQuestionIndex;
            STATE.checkinAnswers = parsedCheckin.checkinAnswers;
            STATE.checkinNote = parsedCheckin.checkinNote || null;
            return true;
        }
    } catch (error) {
        console.warn('Failed to restore active check-in state from sessionStorage:', error);
    }
    return false;
}

/**
 * Stores the identifier of the currently active canvas view in sessionStorage.
 * @param {string} viewId - Canvas element ID (e.g. 'tracker-canvas', 'history-canvas').
 * @returns {void}
 */
export function saveActiveView(viewId) {
    try {
        sessionStorage.setItem(VIEW_STORAGE_KEY, viewId);
    } catch (error) {
        console.warn('Failed to save active view state to sessionStorage:', error);
    }
}

/**
 * Retrieves the last stored active view identifier from sessionStorage.
 * @returns {string | null} Stored view identifier, or null if none or retrieval failed.
 */
export function getStoredActiveView() {
    try {
        return sessionStorage.getItem(VIEW_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to retrieve active view state from sessionStorage:', error);
        return null;
    }
}
