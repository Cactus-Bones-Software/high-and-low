import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import {
    formatCSVCell,
    generateHistoryCSV,
    exportHistoryCSV
} from '../public/js/data-io.js';
import {
    BOOLEAN_NO_SCORE,
    BOOLEAN_YES_SCORE
} from '../public/js/questions.js';

describe('Task 3.12: CSV Export for Sharing with a Clinician Tests', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;

        await waitFor(() => Boolean(
            windowInstance.STATE?.activeQuestions &&
            windowInstance.STATE.activeQuestions.length > 0 &&
            documentInstance.getElementById('progress-text') &&
            documentInstance.getElementById('progress-text').textContent !== 'Loading tracker...'
        ));
    });

    it('1. UI Structure: Renders dedicated Sharing section and CSV export button in Data view', () => {
        const dataPanel = documentInstance.getElementById('panel-data');
        expect(dataPanel).not.toBeNull();

        const shareSection = documentInstance.getElementById('section-share-data');
        expect(shareSection).not.toBeNull();
        expect(shareSection.classList.contains('data-share-section')).toBe(true);

        const shareHeading = shareSection.querySelector('h3');
        expect(shareHeading).not.toBeNull();
        expect(shareHeading.textContent.trim()).toBe('Share with Care Providers');

        const shareDescription = shareSection.querySelector('.data-section-description');
        expect(shareDescription).not.toBeNull();
        expect(shareDescription.textContent).toContain('spreadsheet');

        const csvExportButton = documentInstance.getElementById('button-export-csv');
        expect(csvExportButton).not.toBeNull();
        expect(csvExportButton.textContent.trim()).toBe('Share with Doctor or Therapist (CSV)');

        // Verify layout separation: share section sits above the erase danger section
        const dangerSection = documentInstance.getElementById('section-erase-data');
        expect(dangerSection).not.toBeNull();
        const isFollowing = Boolean(
            shareSection.compareDocumentPosition(dangerSection) & windowInstance.Node.DOCUMENT_POSITION_FOLLOWING
        );
        expect(isFollowing).toBe(true);
    });

    it('2. formatCSVCell: Handles empty values, quoting, and newlines', () => {
        expect(formatCSVCell(null)).toBe('');
        expect(formatCSVCell(undefined)).toBe('');
        expect(formatCSVCell('')).toBe('');
        expect(formatCSVCell('Simple text')).toBe('Simple text');
        expect(formatCSVCell(4)).toBe('4');

        // Contains comma -> wrapped in quotes
        expect(formatCSVCell('Hello, world')).toBe('"Hello, world"');

        // Contains existing double quotes -> escaped as double double-quotes
        expect(formatCSVCell('She said "hi"')).toBe('"She said ""hi"""');

        // Contains newlines -> wrapped in quotes
        expect(formatCSVCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
        expect(formatCSVCell("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    });

    it('3. formatCSVCell: Neutralizes spreadsheet formula injection symbols (=, +, -, @)', () => {
        // Starts with equals sign
        expect(formatCSVCell('=SUM(1,2)')).toBe("\"'=SUM(1,2)\"");

        // Starts with plus sign
        expect(formatCSVCell('+cmd|')).toBe("\"'+cmd|\"");

        // Starts with minus sign (e.g. bullet points in notes)
        expect(formatCSVCell('- Felt exhausted after lunch')).toBe("\"'- Felt exhausted after lunch\"");

        // Starts with at sign
        expect(formatCSVCell('@mention')).toBe("\"'@mention\"");
    });

    it('4. generateHistoryCSV: Formats header row with Timestamp, Date, Note, and question shortLabels', () => {
        const sampleQuestions = [
            { id: 'q_energy', shortLabel: 'Energy Level', text: 'Energy question', responseType: 'scale' },
            { id: 'q_sadness', shortLabel: 'Sadness Depth', text: 'Sadness question', responseType: 'scale' },
            { id: 'q_eaten', shortLabel: 'Eaten Today', text: 'Have you eaten?', responseType: 'boolean' }
        ];

        const sampleEntries = [
            {
                timestamp: '2026-10-20T10:00:00.000Z',
                dateString: '2026-10-20',
                note: 'Morning check-in',
                answers: [
                    { questionId: 'q_energy', score: 4, status: 'answered' },
                    { questionId: 'q_sadness', score: 2, status: 'answered' },
                    { questionId: 'q_eaten', score: BOOLEAN_YES_SCORE, status: 'answered' }
                ]
            }
        ];

        const csvOutput = generateHistoryCSV(sampleEntries, sampleQuestions, ['q_energy', 'q_sadness', 'q_eaten']);
        const lines = csvOutput.split('\r\n');

        expect(lines[0]).toBe('Timestamp,Date,Note,Energy Level,Sadness Depth,Eaten Today');
        expect(lines[1]).toBe('2026-10-20T10:00:00.000Z,2026-10-20,Morning check-in,4,2,Yes');
    });

    it('5. generateHistoryCSV: Includes archived questions that have answers in historical entries', () => {
        const sampleQuestions = [
            { id: 'q_energy', shortLabel: 'Energy Level', text: 'Energy', responseType: 'scale', archived: false },
            { id: 'q_old_test', shortLabel: 'Old Factor', text: 'Old', responseType: 'scale', archived: true },
            { id: 'q_never_used', shortLabel: 'Unused Old', text: 'Unused', responseType: 'scale', archived: true }
        ];

        const sampleEntries = [
            {
                timestamp: '2026-10-20T12:00:00.000Z',
                dateString: '2026-10-20',
                note: null,
                answers: [
                    { questionId: 'q_energy', score: 3, status: 'answered' },
                    { questionId: 'q_old_test', score: 5, status: 'answered' }
                ]
            }
        ];

        const csvOutput = generateHistoryCSV(sampleEntries, sampleQuestions, ['q_energy']);
        const headerLine = csvOutput.split('\r\n')[0];

        // q_old_test must be included because it has an answer in sampleEntries
        expect(headerLine).toContain('Old Factor');

        // q_never_used was archived and has no answers, so it should not create clutter
        expect(headerLine).not.toContain('Unused Old');
    });

    it('6. generateHistoryCSV: Outputs Yes/No for boolean questions, and never writes 0 or -1', () => {
        const sampleQuestions = [
            { id: 'q_eaten', shortLabel: 'Eaten Today', responseType: 'boolean' },
            { id: 'q_scale', shortLabel: 'Scale Score', responseType: 'scale' }
        ];

        const sampleEntries = [
            {
                timestamp: '2026-10-20T08:00:00.000Z',
                dateString: '2026-10-20',
                note: null,
                answers: [
                    { questionId: 'q_eaten', score: BOOLEAN_NO_SCORE, status: 'answered' },
                    { questionId: 'q_scale', score: 1, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-10-20T20:00:00.000Z',
                dateString: '2026-10-20',
                note: null,
                answers: [
                    { questionId: 'q_eaten', score: BOOLEAN_YES_SCORE, status: 'answered' },
                    { questionId: 'q_scale', score: 5, status: 'answered' }
                ]
            }
        ];

        const csvOutput = generateHistoryCSV(sampleEntries, sampleQuestions, ['q_eaten', 'q_scale']);
        const lines = csvOutput.split('\r\n');

        // First row: No for eaten, 1 for scale
        expect(lines[1]).toContain(',No,1');

        // Second row: Yes for eaten, 5 for scale
        expect(lines[2]).toContain(',Yes,5');

        // Never contains 0 or -1 as values
        expect(csvOutput).not.toContain(',0,');
        expect(csvOutput).not.toContain(',-1,');
        expect(csvOutput).not.toContain(',0\r\n');
        expect(csvOutput).not.toContain(',-1\r\n');
    });

    it('7. generateHistoryCSV: Handles skipped answers vs not-asked questions as empty cells', () => {
        const sampleQuestions = [
            { id: 'q_energy', shortLabel: 'Energy Level', responseType: 'scale' },
            { id: 'q_sadness', shortLabel: 'Sadness Depth', responseType: 'scale' },
            { id: 'q_unasked', shortLabel: 'Not In Set', responseType: 'scale' }
        ];

        const sampleEntries = [
            {
                timestamp: '2026-10-20T10:00:00.000Z',
                dateString: '2026-10-20',
                note: '',
                answers: [
                    // Answered
                    { questionId: 'q_energy', score: 4, status: 'answered' },
                    // Skipped
                    { questionId: 'q_sadness', score: null, status: 'skipped' }
                    // q_unasked is omitted entirely (not asked)
                ]
            }
        ];

        const csvOutput = generateHistoryCSV(
            sampleEntries,
            sampleQuestions,
            ['q_energy', 'q_sadness', 'q_unasked']
        );
        const lines = csvOutput.split('\r\n');

        // Row format: Timestamp,Date,Note,Energy Level,Sadness Depth,Not In Set
        // q_energy = 4, q_sadness = empty cell, q_unasked = empty cell
        expect(lines[1]).toBe('2026-10-20T10:00:00.000Z,2026-10-20,,4,,');
    });

    it('8. UI Flow: Shows notice dialog if there are no entries to export', async () => {
        // Ensure entries store is empty
        const database = windowInstance.getDatabase();
        await new Promise((resolve, reject) => {
            const clearTransaction = database.transaction('entries', 'readwrite');
            clearTransaction.objectStore('entries').clear();
            clearTransaction.oncomplete = () => resolve();
            clearTransaction.onerror = () => reject(clearTransaction.error);
        });

        const exportCsvButton = documentInstance.getElementById('button-export-csv');
        expect(exportCsvButton).not.toBeNull();

        exportCsvButton.click();

        await waitFor(() => {
            const noticeOverlay = documentInstance.getElementById('notice-dialog-overlay');
            return noticeOverlay && noticeOverlay.classList.contains('active');
        });

        const noticeTitle = documentInstance.getElementById('notice-dialog-title');
        expect(noticeTitle.textContent.trim()).toBe('No Entries to Export');
    });

    it('9. UI Flow: Clicking CSV export button initiates browser download when entries exist', async () => {
        // Seed a sample entry into IndexedDB
        const sampleEntry = {
            timestamp: '2026-10-24T14:30:00.000Z',
            dateString: '2026-10-24',
            note: 'Doctor visit review',
            answers: [
                { questionId: 'q_energy', score: 3, status: 'answered' },
                { questionId: 'q_sadness', score: 2, status: 'answered' }
            ]
        };
        await windowInstance.put('entries', sampleEntry);

        let createdBlob = null;
        let downloadedFilename = null;

        const originalWindowCreateObjectURL = windowInstance.URL.createObjectURL;
        const originalGlobalCreateObjectURL = global.URL ? global.URL.createObjectURL : undefined;

        const mockCreateObjectURL = (blob) => {
            createdBlob = blob;
            return 'blob:mock-csv-url';
        };

        windowInstance.URL.createObjectURL = mockCreateObjectURL;
        if (global.URL) {
            global.URL.createObjectURL = mockCreateObjectURL;
        }

        // Intercept link clicks in JSDOM
        const clickSpy = vi.spyOn(windowInstance.HTMLAnchorElement.prototype, 'click').mockImplementation(function() {
            downloadedFilename = this.download;
        });

        try {
            const exportCsvButton = documentInstance.getElementById('button-export-csv');
            exportCsvButton.click();

            await waitFor(() => downloadedFilename !== null);

            expect(downloadedFilename).toMatch(/^high-and-low-history-\d{4}-\d{2}-\d{2}\.csv$/);
            expect(createdBlob).not.toBeNull();
            expect(createdBlob.type).toBe('text/csv;charset=utf-8;');
        } finally {
            clickSpy.mockRestore();
            windowInstance.URL.createObjectURL = originalWindowCreateObjectURL;
            if (global.URL && originalGlobalCreateObjectURL) {
                global.URL.createObjectURL = originalGlobalCreateObjectURL;
            }
        }
    });
});
