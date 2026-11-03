import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDOM } from './test-utils.js';
import {
    getCurrentLanguage,
    getCurrentDirection,
    syncDocumentLanguageAndDirection,
    setLanguage,
    registerLocale,
    formatDateTime,
    getValidLocale
} from '../public/js/localization.js';
import { formatEntryDateTime, formatTickDate, computeGraphLayout } from '../public/js/ui/history-graph.js';
import { formatBackupDate } from '../public/js/data-io.js';
import { STATE } from '../public/js/state.js';

describe('Locale-Aware Dates and Document Language', () => {
    let testHarnessEnvironment = null;

    beforeEach(async () => {
        testHarnessEnvironment = await setupTestDOM();
        registerLocale('ar', {
            metadata: { name: 'Arabic', code: 'ar', direction: 'rtl' },
            common: {},
            navigation: {},
            tracker: {},
            questions: {}
        });
        registerLocale('de', {
            metadata: { name: 'German', code: 'de', direction: 'ltr' },
            common: {},
            navigation: {},
            tracker: {},
            questions: {}
        });
    });

    afterEach(() => {
        STATE.language = 'en';
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.lang = 'en';
            document.documentElement.dir = 'ltr';
        }
        vi.restoreAllMocks();
    });

    describe('Document Language (<html lang>) and Direction (<html dir>) Synchronization', () => {
        it('synchronizes html lang and dir attributes to ltr for English by default', () => {
            STATE.language = 'en';
            syncDocumentLanguageAndDirection();
            expect(testHarnessEnvironment.document.documentElement.lang).toBe('en');
            expect(testHarnessEnvironment.document.documentElement.dir).toBe('ltr');
        });

        it('synchronizes html dir to rtl when switching to a right-to-left language', async () => {
            await setLanguage('ar');
            expect(getCurrentLanguage()).toBe('ar');
            expect(getCurrentDirection()).toBe('rtl');
            expect(testHarnessEnvironment.document.documentElement.lang).toBe('ar');
            expect(testHarnessEnvironment.document.documentElement.dir).toBe('rtl');
        });

        it('restores html dir to ltr when switching back from an rtl language to English', async () => {
            await setLanguage('ar');
            expect(testHarnessEnvironment.document.documentElement.dir).toBe('rtl');

            await setLanguage('en');
            expect(getCurrentLanguage()).toBe('en');
            expect(getCurrentDirection()).toBe('ltr');
            expect(testHarnessEnvironment.document.documentElement.lang).toBe('en');
            expect(testHarnessEnvironment.document.documentElement.dir).toBe('ltr');
        });

        it('falls back to default locale for invalid locale tags without throwing', () => {
            expect(getValidLocale('invalid_locale_syntax@@@')).toBe('en');
            expect(getValidLocale(null)).toBe('en');
            expect(getValidLocale(undefined)).toBe('en');
        });
    });

    describe('Entry Date/Time Formatting Across Locales (formatEntryDateTime)', () => {
        const sampleTimestamp = '2026-10-15T13:30:00Z';

        it('formats date and time through formatDateTime using custom options and active locale', () => {
            const date = new Date(sampleTimestamp);
            const formatted = formatDateTime(date, { month: 'short', year: 'numeric' }, 'en');
            expect(formatted).toMatch(/Oct.*2026/);
        });

        it('formats entry date/time in English with month-first order and 12-hour AM/PM convention', () => {
            const formatted = formatEntryDateTime(sampleTimestamp, 'en');
            // English format: month before day (10/15/2026) and 12-hour time with AM or PM
            expect(formatted).toMatch(/10\/15\/2026/);
            expect(formatted).toMatch(/(AM|PM)/i);
        });

        it('formats entry date/time in German with day-first order and 24-hour convention', () => {
            const formatted = formatEntryDateTime(sampleTimestamp, 'de');
            // German format: day before month (15.10.2026) and 24-hour time without AM or PM
            expect(formatted).toMatch(/15\.10\.2026/);
            expect(formatted).toMatch(/\d{1,2}:\d{2}/);
            expect(formatted).not.toMatch(/(AM|PM)/i);
        });

        it('uses active STATE.language when no explicit locale argument is provided', () => {
            STATE.language = 'de';
            const formattedGerman = formatEntryDateTime(sampleTimestamp);
            expect(formattedGerman).toMatch(/15\.10\.2026/);
            expect(formattedGerman).not.toMatch(/(AM|PM)/i);

            STATE.language = 'en';
            const formattedEnglish = formatEntryDateTime(sampleTimestamp);
            expect(formattedEnglish).toMatch(/10\/15\/2026/);
            expect(formattedEnglish).toMatch(/(AM|PM)/i);
        });

        it('handles empty, null, or invalid timestamp strings gracefully', () => {
            expect(formatEntryDateTime('')).toBe('');
            expect(formatEntryDateTime(null)).toBe('');
            expect(formatEntryDateTime(undefined)).toBe('');
            expect(formatEntryDateTime('not-a-valid-date')).toBe('not-a-valid-date');
        });
    });

    describe('Graph X-Axis Tick Date Formatting Across Locales (formatTickDate)', () => {
        const sampleTimeMilliseconds = new Date('2026-10-15T13:30:00Z').getTime();

        it('formats multi-day tick in English with month/day order', () => {
            const formatted = formatTickDate(sampleTimeMilliseconds, false, 'en');
            expect(formatted).toBe('10/15');
        });

        it('formats multi-day tick in German with day.month. order', () => {
            const formatted = formatTickDate(sampleTimeMilliseconds, false, 'de');
            expect(formatted).toBe('15.10.');
        });

        it('formats short-range tick in English including 12-hour time with AM/PM', () => {
            const formatted = formatTickDate(sampleTimeMilliseconds, true, 'en');
            expect(formatted).toMatch(/10\/15/);
            expect(formatted).toMatch(/(AM|PM)/i);
        });

        it('formats short-range tick in German including 24-hour time without AM/PM', () => {
            const formatted = formatTickDate(sampleTimeMilliseconds, true, 'de');
            expect(formatted).toMatch(/15\.10\./);
            expect(formatted).toMatch(/\d{1,2}:\d{2}/);
            expect(formatted).not.toMatch(/(AM|PM)/i);
        });

        it('handles NaN or invalid time milliseconds gracefully', () => {
            expect(formatTickDate(Number.NaN, false)).toBe('');
            expect(formatTickDate(undefined, false)).toBe('');
        });
    });

    describe('Data View Backup Date Formatting (formatBackupDate)', () => {
        const sampleTimestamp = '2026-10-15T13:30:00Z';

        it('formats backup date in English with month/day/year order', () => {
            const formatted = formatBackupDate(sampleTimestamp, 'en');
            expect(formatted).toBe('10/15/2026');
        });

        it('formats backup date in German with day.month.year order', () => {
            const formatted = formatBackupDate(sampleTimestamp, 'de');
            expect(formatted).toBe('15.10.2026');
        });

        it('handles null, undefined, and empty string gracefully', () => {
            expect(formatBackupDate(null)).toBe('');
            expect(formatBackupDate(undefined)).toBe('');
            expect(formatBackupDate('')).toBe('');
            expect(formatBackupDate('not-a-date')).toBe('');
        });
    });

    describe('Graph Layout Integration with Active Locale', () => {
        it('renders data points and tooltips with German date conventions when German is active', () => {
            STATE.language = 'de';
            const entries = [
                {
                    timestamp: '2026-10-15T13:30:00Z',
                    answers: [{ questionId: 'q_energy', score: 4, status: 'answered' }]
                }
            ];
            const questions = [
                { id: 'q_energy', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }
            ];

            const layout = computeGraphLayout({
                entries,
                questions,
                visibleQuestionIds: new Set(['q_energy'])
            });

            expect(layout.series.length).toBe(1);
            expect(layout.series[0].points.length).toBe(1);
            const point = layout.series[0].points[0];
            // Point formattedDate must use German day-first date format
            expect(point.formattedDate).toMatch(/15\.10\.2026/);
            expect(point.formattedDate).not.toMatch(/(AM|PM)/i);
        });

        it('renders data points and tooltips with English date conventions when English is active', () => {
            STATE.language = 'en';
            const entries = [
                {
                    timestamp: '2026-10-15T13:30:00Z',
                    answers: [{ questionId: 'q_energy', score: 4, status: 'answered' }]
                }
            ];
            const questions = [
                { id: 'q_energy', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }
            ];

            const layout = computeGraphLayout({
                entries,
                questions,
                visibleQuestionIds: new Set(['q_energy'])
            });

            const point = layout.series[0].points[0];
            // Point formattedDate must use English month-first date format
            expect(point.formattedDate).toMatch(/10\/15\/2026/);
            expect(point.formattedDate).toMatch(/(AM|PM)/i);
        });
    });
});
