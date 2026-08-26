/**
 * HIGH & LOW - SESSION PERSISTENCE
 * sessionStorage-backed persistence for an in-progress check-in and the
 * last active view, so a reload or accidental navigation doesn't lose state.
 */

import { STATE } from '../state.js';

export const CHECKIN_STORAGE_KEY = 'high_and_low_active_checkin';
export const VIEW_STORAGE_KEY = 'high_and_low_active_view';
export const CHECKIN_TIMEOUT_MS = 30 * 60 * 1000; // 30-minute timeout for stale check-ins

export function saveActiveCheckin() {
    try {
        const payload = {
            currentQuestionIndex: STATE.currentQuestionIndex,
            checkinAnswers: STATE.checkinAnswers,
            checkinNote: STATE.checkinNote,
            updatedAt: Date.now()
        };
        sessionStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
}

export function clearActiveCheckin() {
    try {
        sessionStorage.removeItem(CHECKIN_STORAGE_KEY);
    } catch (_) {}
}

export function restoreActiveCheckin() {
    try {
        const rawCheckin = sessionStorage.getItem(CHECKIN_STORAGE_KEY);
        if (!rawCheckin) return false;
        const parsedCheckin = JSON.parse(rawCheckin);
        if (parsedCheckin && typeof parsedCheckin.currentQuestionIndex === 'number' && Array.isArray(parsedCheckin.checkinAnswers)) {
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
    } catch (_) {}
    return false;
}

export function saveActiveView(viewId) {
    try {
        sessionStorage.setItem(VIEW_STORAGE_KEY, viewId);
    } catch (_) {}
}

export function getStoredActiveView() {
    try {
        return sessionStorage.getItem(VIEW_STORAGE_KEY);
    } catch (_) {
        return null;
    }
}