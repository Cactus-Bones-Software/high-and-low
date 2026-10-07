/**
 * HIGH & LOW - ENGLISH (EN) TRANSLATION MODULE
 * Drop-in localization module for English.
 */

export default {
    metadata: {
        code: 'en',
        name: 'English',
        direction: 'ltr'
    },
    common: {
        yes: 'Yes',
        no: 'No',
        back: 'Back',
        cancel: 'Cancel',
        save: 'Save',
        remove: 'Remove',
        restore: 'Restore',
        edit: 'Edit',
        copy: 'Copy',
        gotIt: 'Got It',
        notice: 'Notice',
        preview: 'Preview'
    },
    navigation: {
        menuTitle: 'Navigation Menu',
        openMenu: 'Open menu & navigation',
        tracker: 'Mood Tracker',
        history: 'History',
        questions: 'Questions',
        data: 'Data & Backups',
        settings: 'Settings',
        restartCheckin: 'Restart Check-In',
        backToTracker: 'Back to Mood Tracker'
    },
    tracker: {
        progress: 'Question {current} of {total}',
        loading: 'Loading tracker...',
        initializing: 'Initializing High & Low...',
        scoreOutOfFive: 'Score {score} out of 5',
        selectScore: 'Select score from 1 to 5',
        selectYesOrNo: 'Select Yes or No',
        completeTitle: 'Check-In Complete',
        completeSubtitle: 'Mood recorded. Rest easy.',
        savedSecurely: 'Saved securely to device storage.',
        recordAnother: 'Record Another Check-In',
        addNote: 'Add Note',
        noteAttached: 'Note Attached ✓',
        addNoteAria: 'Add custom note (Hold to confirm)',
        noteAttachedAria: 'Note Attached (Hold to confirm)',
        skipTheRest: 'Skip the Rest',
        skipTheRestAria: 'Skip remaining questions (Hold to confirm)',
        storageError: 'Could not open local storage.'
    },
    settings: {
        title: 'Application Settings',
        preferencesHeading: 'Display & Interaction Preferences',
        language: 'Language:',
        languageEnglish: 'English',
        languageSpanish: 'Español',
        theme: 'Theme:',
        themeSystem: 'Match System',
        themeDark: 'Muted Dark',
        themeLight: 'Clean Light',
        contrast: 'Contrast:',
        contrastLow: 'Low (Gentle on eyes)',
        contrastHigh: 'High (Crisp Text)',
        holdDelay: 'Hold to Confirm Delay:',
        holdDelayEnabled: 'Enabled (1.5 s hold protection)',
        holdDelayDisabled: 'Disabled (Instant click/tap)',
        handedness: 'Handedness:',
        handednessRight: 'Right-Handed (Menu right)',
        handednessLeft: 'Left-Handed (Menu left)'
    },
    questions: {
        title: 'Questions Catalog & Authoring',
        searchPlaceholder: 'Search by text, label, or tag…',
        activeHeading: 'Active in Tracker',
        catalogHeading: 'Question Catalog',
        activeEmpty: 'No active questions match your search.',
        catalogEmpty: 'No catalog questions match your search.',
        archivedEmpty: 'No removed questions match your search.',
        emptyActive: 'No active questions match your search.',
        emptyCatalog: 'No catalog questions match your search.',
        showRemoved: 'Show Removed Questions',
        hideRemoved: 'Hide Removed Questions',
        addCustomQuestionAria: 'Add a custom question',
        badgeBuiltIn: 'Built-in',
        badgeCustom: 'Custom',
        badgeRemoved: 'Removed',
        addToTracker: 'Add to Tracker',
        removeFromTracker: 'Remove from Tracker',
        modalAddTitle: 'Add Custom Question',
        modalAddSubtitle: 'Create a new question for your library and optional daily tracker.',
        modalEditTitle: 'Edit Custom Question',
        modalEditSubtitle: 'Update question details or remove this question.',
        modalCopyTitle: 'Copy Question',
        modalCopySubtitle: 'Create a custom question based on this built-in question.',
        fieldQuestion: 'Question',
        fieldShortLabel: 'Short label',
        fieldShortLabelHint: '(for charts & lists)',
        fieldTags: 'Tags',
        fieldTagsHint: '(comma-separated, optional)',
        fieldTagsDescription: 'Use short category tags to make questions easier to find later.',
        fieldResponseType: 'Response type',
        responseTypeScale: '5-Point Scale',
        responseTypeBoolean: 'Yes/No',
        fieldCurve: 'Scale direction',
        curveMoreIsBetter: 'Higher is better',
        curveLessIsBetter: 'Lower is better',
        curveMiddleIsBest: 'Middle is best',
        fieldMaxLabel: 'Top label',
        fieldMidLabel: 'Middle label',
        fieldMinLabel: 'Bottom label',
        optionalHint: '(optional)',
        scaleHint: 'Leave a label blank, and that button simply shows its number.',
        addToDailySet: 'Add to my daily set now',
        saveQuestion: 'Save Question',
        saveChanges: 'Save Changes',
        removeQuestion: 'Remove Question',
        noticeRemovedTitle: 'Question Removed',
        noticeRemovedMessage: 'This question has been removed.',
        noticeRestoredTitle: 'Question Restored',
        noticeRestoredMessage: 'The question has been restored to your question catalog.',
        noticeUpdatedTitle: 'Question Updated',
        noticeUpdatedMessage: 'Your changes have been saved to this question.',
        noticeSavedTitle: 'Question Saved',
        noticeSavedMessage:
            'Your custom question has been saved and will appear in your check-in tracker.',
        noticeRestoredExistingMessage:
            'That question already existed in your removed items and has been restored.',
        noticeExistsTitle: 'Question Exists',
        noticeExistsMessage: 'You already have an active question with this text in your library.',
        noticeCouldNotSaveTitle: 'Could Not Save',
        noticeCouldNotRemoveTitle: 'Could Not Remove',
        noticeBuiltInTitle: 'Built-in Question',
        noticeBuiltInMessage:
            'Built-in questions are part of the core tracker and cannot be edited or removed.',
        errorRequired: 'Question text and short label are required.',
        errorCopyDuplicate: 'Please change the question text so this copy has a unique prompt.',
        errorGeneric: 'Could not save question. Please verify all fields.'
    },
    data: {
        title: 'Data Management & Backups',
        heading: 'Export & Import Data',
        backupButton: 'Backup Data & Settings',
        importButton: 'Import Backup File',
        importModalTitle: 'Import Data',
        importModalSubtitle: 'Choose how you want to restore or merge this backup.',
        selectedFileLabel: 'Selected file:',
        smartMergeDescription:
            'Smart Merge combines backup records with your current history without erasing data.',
        wipeReplaceDescription:
            'Wipe & Replace clears all local records and replaces them entirely with this backup.',
        smartMergeButton: 'Smart Merge',
        wipeReplaceButton: 'Wipe & Replace',
        invalidBackupTitle: 'Invalid Backup File',
        invalidBackupMessage:
            'The selected file is missing required blueprint structure (entries or configuration).',
        corruptedTitle: 'Corrupted File',
        corruptedMessage: 'The selected file could not be parsed or contains corrupted data.'
    },
    history: {
        title: 'History',
        timelineHeading: 'Mood Timeline',
        emptyTitle: 'Empty Timeline',
        emptySubtitle: 'No recorded mood history yet.',
        timelinePrompt: 'Your mood history will appear here over time.',
        timeframes: {
            '7d': '7 Days',
            '14d': '14 Days',
            '30d': '30 Days',
            '90d': '90 Days',
            'all': 'All Time'
        },
        timeframeButtons: {
            '7d': '~7D',
            '14d': '~14D',
            '30d': '~30D',
            '90d': '~90D',
            'all': 'All'
        },
        timeframeAria: {
            '7d': 'Zoom to ~7 days',
            '14d': 'Zoom to ~14 days',
            '30d': 'Zoom to ~30 days',
            '90d': 'Zoom to ~90 days',
            'all': 'Zoom to all entries'
        },
        scale: 'Scale',
        scaleAria: 'Timeline zoom scale presets',
        selectPresetAria: 'Select zoom preset',
        zoomControlsAria: 'Timeline zoom controls',
        zoomOutAria: 'Zoom out timeline',
        zoomInAria: 'Zoom in timeline',
        zoomReset: 'Reset',
        zoomResetAria: 'Reset timeline zoom',
        panToLatestAria: 'Pan timeline to latest entries',
        filterQuestions: 'Filter Questions',
        filterQuestionsAria: 'Timeline question quick filters',
        showAll: 'Show all',
        showAllAria: 'Show all questions on timeline',
        clearAll: 'Clear all',
        clearAllAria: 'Clear all questions on timeline',
        now: 'NOW',
        answered: 'Answered',
        skipped: 'Skipped',
        notAsked: 'Not Asked',
        noteTitle: 'Check-In Note',
        closePrompt: 'Tap anywhere to close'
    },
    notes: {
        modalTitle: 'Check-In Note',
        modalSubtitle: 'Add optional observations, context, or triggers for this check-in.',
        placeholder: 'e.g. Slept poorly, feeling restless or distracted...',
        saveNote: 'Save Note'
    },
    testingBanner: 'This version is for testing only. Do not use it for psychiatric purposes.',
    builtInQuestions: {
        q_energy: {
            text: 'How is your energy right now?',
            shortLabel: 'Energy Level'
        },
        q_mood: {
            text: 'How is your overall mood right now?',
            shortLabel: 'Overall Mood'
        },
        q_anxiety: {
            text: 'How much anxiety or tension are you experiencing?',
            shortLabel: 'Anxiety'
        },
        q_focus: {
            text: 'How clearly and easily can you focus?',
            shortLabel: 'Mental Focus'
        },
        q_irritability: {
            text: 'How irritable or easily frustrated do you feel?',
            shortLabel: 'Irritability'
        },
        q_sleep_rested: {
            text: 'Did you wake up feeling sufficiently rested?',
            shortLabel: 'Sleep Restedness'
        }
    }
};
