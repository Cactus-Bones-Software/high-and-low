/**
 * HIGH & LOW - QUESTION IDENTITY, SEEDING & UTILITIES
 * Core question definitions, FNV-1a custom ID hashing, seeding, and curve mappings.
 */

import { STATE } from './state.js';
import { getAll, getConfig, setConfig, getDatabase } from './storage/db.js';

// Bump this whenever new entries are added to DEFAULT_QUESTIONS so that existing
// installations pick up the new built-ins on next load (see seedDefaults) without
// disturbing the user's own active set or authored questions.
export const SEED_VERSION = 4;

export const ALLOWED_RESPONSE_TYPES = ['scale', 'boolean'];

// Single source of truth for how boolean (Yes/No) responses map onto the 1–5 scale.
// Stored as mapped numeric scores so existing persistence and graph pipelines work uniformly.
export const BOOLEAN_NO_SCORE = 1;
export const BOOLEAN_YES_SCORE = 5;

// Built-in questions shipped with the app. User-authored questions live in the
// same 'questions' store but with builtIn:false and a content-addressed id
// (see makeCustomId). Built-ins use readable slugs for export/debug legibility.
export const DEFAULT_QUESTIONS = [
    {
        id: 'q_energy',
        responseType: 'scale',
        text: 'What is your current energy level?',
        shortLabel: 'Energy Level',
        tags: ['Energy', 'Somatic'],
        curve: 'more-is-better',
        minLabel: 'Bedbound/Depleted',
        maxLabel: 'Fully Charged',
        midLabel: null
    },
    {
        id: 'q_sadness',
        responseType: 'scale',
        text: 'How heavy or deep is your sadness right now?',
        shortLabel: 'Sadness Depth',
        tags: ['Mood', 'Affect'],
        curve: 'less-is-better',
        minLabel: 'No Sadness',
        maxLabel: 'Overwhelming',
        midLabel: null
    },
    {
        id: 'q_worth',
        responseType: 'scale',
        text: 'How is your sense of self-worth and guilt?',
        shortLabel: 'Self-Worth',
        tags: ['Cognitive', 'Self-Esteem'],
        curve: 'more-is-better',
        minLabel: 'Intense Guilt/Worthless',
        maxLabel: 'At Peace',
        midLabel: null
    },
    {
        id: 'q_irritability',
        responseType: 'scale',
        text: 'How irritable or easily agitated do you feel?',
        shortLabel: 'Irritability',
        tags: ['Mood', 'Reactivity'],
        curve: 'less-is-better',
        minLabel: 'Calm & Patient',
        maxLabel: 'Highly Snappy',
        midLabel: null
    },
    {
        id: 'q_racing',
        responseType: 'scale',
        text: 'How fast are your thoughts moving?',
        shortLabel: 'Racing Thoughts',
        tags: ['Cognitive', 'Pacing'],
        curve: 'less-is-better',
        minLabel: 'Quiet & Focused',
        maxLabel: 'Unstoppable Racing',
        midLabel: null
    },
    {
        id: 'q_impulse',
        responseType: 'scale',
        text: 'Are you experiencing restless or reckless urges?',
        shortLabel: 'Restless Urges',
        tags: ['Behavioral', 'Impulse'],
        curve: 'less-is-better',
        minLabel: 'Deliberate',
        maxLabel: 'Highly Impulsive',
        midLabel: null
    },
    {
        id: 'q_overall',
        responseType: 'scale',
        text: 'Overall, where does your mood sit right now?',
        shortLabel: 'Overall Mood',
        tags: ['Mood', 'Core'],
        curve: 'middle-is-best',
        minLabel: 'Deeply Low',
        maxLabel: 'Manic/Spiked',
        midLabel: 'Stable & Even'
    },
    {
        id: 'q_eaten',
        responseType: 'boolean',
        text: 'Have you eaten today?',
        shortLabel: 'Eaten Today',
        tags: ['Somatic', 'Physical'],
        curve: 'more-is-better',
        minLabel: null,
        maxLabel: null,
        midLabel: null
    }
];

// Daily set established on first run (ids into the 'questions' store).
export const DEFAULT_ACTIVE_SET = ['q_energy', 'q_sadness', 'q_irritability', 'q_overall'];

// Collapse leading/trailing and internal whitespace so trivially-different
// wordings resolve to the same content-addressed id.
export function normalizeQuestionText(text) {
    return text.trim().replace(/\s+/g, ' ');
}

// FNV-1a 32-bit -> 8 hex chars. NOT cryptographic: used only for stable,
// content-addressed question identity. Identical (normalized) text yields an
// identical id, which lets identical questions self-dedupe when backups merge.
export function fnv1a32(inputString) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < inputString.length; index++) {
        hash ^= inputString.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

// Custom (user-authored) question ids are prefixed 'c_' so a raw export is
// human-scannable against the built-in 'q_' slugs. The id is frozen at creation
// from the original text; later edits to display text never change it, so
// historical entries never orphan.
export function makeCustomId(text) {
    return 'c_' + fnv1a32(normalizeQuestionText(text));
}

// Idempotently insert any built-in question whose id is not already present.
// Runs every load: because we never hard-delete (only archive), an id the user
// archived still exists and won't be re-added, while genuinely new built-ins in
// a later SEED_VERSION get picked up automatically.
export async function seedDefaults() {
    const existingQuestions = await getAll('questions');
    const existingQuestionIds = new Set(existingQuestions.map(question => question.id));
    const storedSeedVersion = await getConfig('seedVersion');
    const now = new Date().toISOString();

    const database = getDatabase();
    if (database) {
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(['questions'], 'readwrite');
            const store = transaction.objectStore('questions');
            const updatedQuestionIds = new Set();

            DEFAULT_QUESTIONS.forEach(question => {
                if (!existingQuestionIds.has(question.id)) {
                    store.add({
                        ...question,
                        responseType: question.responseType || 'scale',
                        originalText: question.text,
                        tags: Array.isArray(question.tags) ? question.tags : [],
                        builtIn: true,
                        archived: false,
                        createdAt: now,
                        updatedAt: now
                    });
                } else {
                    const existingQuestion = existingQuestions.find(item => item.id === question.id);
                    if (existingQuestion) {
                        const needsTagUpdate = !Array.isArray(existingQuestion.tags) ||
                            existingQuestion.tags.length === 0;
                        const needsShortLabelUpdate = !existingQuestion.shortLabel ||
                            existingQuestion.shortLabel !== question.shortLabel;
                        const needsResponseTypeUpdate = !existingQuestion.responseType;

                        if (needsTagUpdate || needsShortLabelUpdate || needsResponseTypeUpdate) {
                            store.put({
                                ...existingQuestion,
                                responseType: existingQuestion.responseType || question.responseType || 'scale',
                                shortLabel: question.shortLabel,
                                tags: Array.isArray(existingQuestion.tags) && existingQuestion.tags.length > 0
                                    ? existingQuestion.tags
                                    : (question.tags || []),
                                updatedAt: now
                            });
                            updatedQuestionIds.add(existingQuestion.id);
                        }
                    }
                }
            });

            // Backfill responseType: "scale" onto any existing stored question records (e.g. custom questions)
            // that predate this field, keeping all stored records consistent.
            existingQuestions.forEach(existingQuestion => {
                if (!updatedQuestionIds.has(existingQuestion.id) && !existingQuestion.responseType) {
                    store.put({
                        ...existingQuestion,
                        responseType: 'scale',
                        updatedAt: now
                    });
                }
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // First run only: establish the default active set.
    if (storedSeedVersion === undefined) {
        await setConfig('activeQuestionSet', DEFAULT_ACTIVE_SET);
    }
    await setConfig('seedVersion', SEED_VERSION);
}

// Resolve the ordered active-set ids into full question definitions, dropping
// any that are missing or archived.
export async function loadActiveQuestions() {
    const [allQuestions, activeSet] = await Promise.all([getAll('questions'), getConfig('activeQuestionSet')]);
    const questionsById = new Map(allQuestions.map(question => [question.id, question]));
    const set = Array.isArray(activeSet) ? activeSet : DEFAULT_ACTIVE_SET;
    STATE.activeQuestions = set.map(id => questionsById.get(id)).filter(question => question && !question.archived);
}

// Reorder the active question set to match an explicit array of question ids.
export async function reorderActiveQuestions(orderedQuestionIds) {
    if (!Array.isArray(orderedQuestionIds)) return false;
    await setConfig('activeQuestionSet', orderedQuestionIds);
    await loadActiveQuestions();
    return true;
}

// Reorder an active question up or down within the active set sequence.
export async function moveActiveQuestion(questionId, direction) {
    const activeSet = await getConfig('activeQuestionSet');
    const set = Array.isArray(activeSet) ? [...activeSet] : [...DEFAULT_ACTIVE_SET];
    const currentIndex = set.indexOf(questionId);
    if (currentIndex === -1) return false;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= set.length) return false;

    const [movedQuestionId] = set.splice(currentIndex, 1);
    set.splice(targetIndex, 0, movedQuestionId);

    await setConfig('activeQuestionSet', set);
    await loadActiveQuestions();
    return true;
}

// Remove an active question from the tracker into the catalog.
export async function removeQuestionFromTracker(questionId) {
    const activeSet = await getConfig('activeQuestionSet');
    const set = Array.isArray(activeSet) ? [...activeSet] : [...DEFAULT_ACTIVE_SET];
    const updatedQuestionSet = set.filter(id => id !== questionId);

    await setConfig('activeQuestionSet', updatedQuestionSet);
    await loadActiveQuestions();
    return true;
}

// Add an inactive question from the catalog into the active tracker.
export async function addQuestionToTracker(questionId) {
    const activeSet = await getConfig('activeQuestionSet');
    const set = Array.isArray(activeSet) ? [...activeSet] : [...DEFAULT_ACTIVE_SET];
    if (!set.includes(questionId)) {
        set.push(questionId);
        await setConfig('activeQuestionSet', set);
        await loadActiveQuestions();
    }
    return true;
}

// Persist a user-authored question.
export async function createCustomQuestion({
                                               text,
                                               shortLabel,
                                               tags,
                                               curve,
                                               minLabel,
                                               maxLabel,
                                               midLabel,
                                               addToSet,
                                               responseType = 'scale'
                                           }) {
    const normalized = normalizeQuestionText(text || '');
    const normalizedShort = normalizeQuestionText(shortLabel || '');
    if (!normalized) throw new Error('Question text is required.');
    if (!normalizedShort) throw new Error('Short label is required.');

    const validatedResponseType = responseType === undefined ? 'scale' : responseType;
    if (!ALLOWED_RESPONSE_TYPES.includes(validatedResponseType)) {
        throw new Error(
            `Invalid responseType: "${responseType}". Must be one of: ${ALLOWED_RESPONSE_TYPES.join(', ')}.`
        );
    }

    const normalizedTags = Array.isArray(tags)
        ? tags.map(tag => typeof tag === 'string' ? tag.trim() : '').filter(Boolean)
        : (typeof tags === 'string'
            ? tags.split(',').map(tag => tag.trim()).filter(Boolean)
            : []);

    const id = makeCustomId(normalized);
    const now = new Date().toISOString();

    const database = getDatabase();
    const outcome = await new Promise((resolve, reject) => {
        if (!database) {
            return reject(new Error('IndexedDB database instance is not available.'));
        }
        const transaction = database.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        let result = null;

        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (existing) {
                if (existing.archived) {
                    const restored = {
                        ...existing,
                        shortLabel: normalizedShort,
                        tags: normalizedTags.length > 0 ? normalizedTags : (existing.tags || []),
                        responseType: validatedResponseType,
                        archived: false,
                        updatedAt: now
                    };
                    store.put(restored);
                    result = { status: 'restored', id, question: restored };
                } else {
                    result = { status: 'exists', id, question: existing };
                }
            } else {
                const question = {
                    id,
                    text: normalized,
                    shortLabel: normalizedShort,
                    tags: normalizedTags,
                    originalText: normalized,
                    responseType: validatedResponseType,
                    curve,
                    minLabel: minLabel || null,
                    maxLabel: maxLabel || null,
                    midLabel: curve === 'middle-is-best' ? (midLabel || null) : null,
                    builtIn: false,
                    archived: false,
                    createdAt: now,
                    updatedAt: now
                };
                store.add(question);
                result = { status: 'added', id, question };
            }
        };

        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
    });

    if (addToSet) {
        const activeSet = await getConfig('activeQuestionSet');
        const set = Array.isArray(activeSet) ? activeSet.slice() : DEFAULT_ACTIVE_SET.slice();
        if (!set.includes(outcome.id)) {
            set.push(outcome.id);
            await setConfig('activeQuestionSet', set);
        }
    }

    return outcome;
}

export async function updateCustomQuestion(questionId, updates = {}) {
    if (!questionId || typeof questionId !== 'string') {
        throw new Error('Valid question ID is required to update a question.');
    }

    const database = getDatabase();
    if (!database) {
        throw new Error('IndexedDB database instance is not available.');
    }

    const now = new Date().toISOString();

    const updatedRecord = await new Promise((resolve, reject) => {
        const transaction = database.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');

        const getRequest = store.get(questionId);
        getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (!existing) {
                return reject(new Error(`Question not found with ID: ${questionId}`));
            }
            if (existing.builtIn) {
                return reject(new Error('Built-in questions cannot be edited.'));
            }

            const rawText = typeof updates.text === 'string' ? updates.text : existing.text;
            const normalizedText = normalizeQuestionText(rawText);
            if (!normalizedText) {
                return reject(new Error('Question text cannot be empty.'));
            }

            const rawShortLabel = typeof updates.shortLabel === 'string'
                ? updates.shortLabel
                : existing.shortLabel;
            const normalizedShortLabel = normalizeQuestionText(rawShortLabel);
            if (!normalizedShortLabel) {
                return reject(new Error('Short label cannot be empty.'));
            }

            let tags = existing.tags || [];
            if (updates.tags !== undefined) {
                if (Array.isArray(updates.tags)) {
                    tags = updates.tags
                        .map(tag => typeof tag === 'string' ? tag.trim() : '')
                        .filter(tag => tag.length > 0);
                } else if (typeof updates.tags === 'string') {
                    tags = updates.tags
                        .split(',')
                        .map(tag => tag.trim())
                        .filter(tag => tag.length > 0);
                }
            }

            let responseType = existing.responseType || 'scale';
            if (updates.responseType !== undefined) {
                if (!ALLOWED_RESPONSE_TYPES.includes(updates.responseType)) {
                    return reject(new Error(
                        `Invalid responseType: "${updates.responseType}". Must be one of: ${ALLOWED_RESPONSE_TYPES.join(', ')}.`
                    ));
                }
                responseType = updates.responseType;
            }

            const curve = updates.curve || existing.curve || 'more-is-better';
            const minLabel = updates.minLabel !== undefined ? (updates.minLabel || null) : existing.minLabel;
            const maxLabel = updates.maxLabel !== undefined ? (updates.maxLabel || null) : existing.maxLabel;
            const midLabel = curve === 'middle-is-best'
                ? (updates.midLabel !== undefined ? (updates.midLabel || null) : existing.midLabel)
                : null;

            // Preserve immutable properties: id, originalText, builtIn, createdAt
            const recordToSave = {
                ...existing,
                id: existing.id,
                originalText: existing.originalText || existing.text,
                builtIn: false,
                createdAt: existing.createdAt,
                text: normalizedText,
                shortLabel: normalizedShortLabel,
                tags,
                responseType,
                curve,
                minLabel,
                maxLabel,
                midLabel,
                updatedAt: now
            };

            store.put(recordToSave);
            transaction.oncomplete = () => resolve(recordToSave);
        };

        transaction.onerror = () => reject(transaction.error);
    });

    await loadActiveQuestions();
    return updatedRecord;
}

export async function archiveQuestion(questionId) {
    if (!questionId || typeof questionId !== 'string') {
        throw new Error('Valid question ID is required to archive a question.');
    }

    const database = getDatabase();
    if (!database) {
        throw new Error('IndexedDB database instance is not available.');
    }

    const now = new Date().toISOString();

    const archivedRecord = await new Promise((resolve, reject) => {
        const transaction = database.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');

        const getRequest = store.get(questionId);
        getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (!existing) {
                return reject(new Error(`Question not found with ID: ${questionId}`));
            }

            const recordToSave = {
                ...existing,
                archived: true,
                updatedAt: now
            };

            store.put(recordToSave);
            transaction.oncomplete = () => resolve(recordToSave);
        };

        transaction.onerror = () => reject(transaction.error);
    });

    const activeSet = await getConfig('activeQuestionSet');
    if (Array.isArray(activeSet) && activeSet.includes(questionId)) {
        const updatedSet = activeSet.filter(identifier => identifier !== questionId);
        await setConfig('activeQuestionSet', updatedSet);
    }

    await loadActiveQuestions();
    return archivedRecord;
}

export async function restoreQuestion(questionId) {
    if (!questionId || typeof questionId !== 'string') {
        throw new Error('Valid question ID is required to restore a question.');
    }

    const database = getDatabase();
    if (!database) {
        throw new Error('IndexedDB database instance is not available.');
    }

    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');

        const getRequest = store.get(questionId);
        getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (!existing) {
                return reject(new Error(`Question not found with ID: ${questionId}`));
            }

            const recordToSave = {
                ...existing,
                archived: false,
                updatedAt: now
            };

            store.put(recordToSave);
            transaction.oncomplete = () => resolve(recordToSave);
        };

        transaction.onerror = () => reject(transaction.error);
    });
}

export const archiveCustomQuestion = archiveQuestion;
export const restoreCustomQuestion = restoreQuestion;
export const removeQuestion = archiveQuestion;
export const removeCustomQuestion = archiveQuestion;

export function getCurveColor(curve, index) {
    if (curve === 'more-is-better') return '#34c759';
    if (curve === 'less-is-better') return '#ff3b30';
    if (curve === 'middle-is-best') return '#007aff';
    const fallbackPalette = ['#34c759', '#ff3b30', '#007aff', '#af52de', '#ff9500', '#5ac8fa'];
    return fallbackPalette[index % fallbackPalette.length];
}

export const QUESTION_DASH_PATTERNS = [
    'none',          // 0: Solid line
    '6,4',           // 1: Medium dashes
    '2,3',           // 2: Dotted
    '8,3,2,3',       // 3: Dash-dot
    '12,4',          // 4: Long dashes
    '6,3,2,3,2,3',   // 5: Dash-dot-dot
    '10,3,4,3'       // 6: Long-dash short-dash
];

export function getQuestionDashArray(index) {
    return QUESTION_DASH_PATTERNS[index % QUESTION_DASH_PATTERNS.length];
}
