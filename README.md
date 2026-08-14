# High & Low

**High & Low** is a local-first, zero-friction mood tracker designed specifically for individuals navigating bipolar and unipolar mood cycles (both depressive lows and manic/hypomanic highs).

---

## What It Is

High & Low is a lightweight, offline-capable web application built to make mood tracking effort-free—especially on severe low-energy days. It uses simple 1–5 rating scales and binary Yes/No check-ins presented one card at a time, keeping cognitive load to a minimum.

---

## Key Features

- **Low-Energy Tracker Deck**: One, easy to answer question on screen at a time.
- **"Skip the Rest" Escape Hatch**: Complete a check-in instantly at any point without feeling guilty or breaking things.
- **Mood History Timeline**: See how your answers have changed over time, and read your notes.
- **Custom Question Library**: Create, tag, and organize custom questions with several color schemes, or Yes/No toggles.
- **100% Private & Local-First**: Your data never leaves your device until you decide it should. No accounts, external servers, or tracking cookies.
- **Ergonomics & Handedness Support**: Configurable left- or right-handed drawer positioning, dark/light theme switching, and high-contrast modes.
- **Full Data Ownership**: Export or import your entire tracking history anytime, or even merge multiple backups

---

## Why It Exists

Most mood tracking tools demand high cognitive effort: overwhelming amounts of questions, mandatory journal entries, clutter, or cloud accounts. During intense depressive lows or hyperactive manic phases, these barriers often cause tracking habits to collapse entirely.

High & Low exists to eliminate that friction. By prioritizing rapid tap choices, touch-safe ergonomics, forgiving skip options, and strict privacy, High & Low ensures that you can still track your mood when you need it most.

---

## Technical Writeup

### Architecture Overview

High & Low is built as a zero-dependency, local-first Progressive Web Application (PWA). It executes entirely in the client browser with no external network requests, third-party trackers, or cloud backend dependencies.

```
┌──────────────────────────────────────────────────────────┐
│                   Browser Client (PWA)                   │
│                                                          │
│  ┌───────────────────┐  ┌─────────────────────────────┐  │
│  │ Single-Card Deck  │  │   Navigation & Drawer UI    │  │
│  │ (State Machine)   │  │   (History / Questions)     │  │
│  └─────────┬─────────┘  └──────────────┬──────────────┘  │
│            │                           │                 │
│            ▼                           ▼                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │             IndexedDB Engine (v2)                  │  │
│  │  • `config`     • `questions`     • `logs`         │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Core Tech Stack

* **Frontend Engine**: Vanilla JavaScript (ES6+), Vanilla CSS3 with semantic Custom Properties, Semantic HTML5.
* **Storage Layer**: IndexedDB (`HighAndLowDB` v2) for transactional, asynchronous on-device persistence.
* **Offline Capabilities**: Service Worker cache layer (`sw.js`) and PWA web app manifest (`manifest.json`).

### Interaction & Ergonomics Design

* **Input Differentiation & Safety**: Touch interactions on destructive, session-terminating, or dialog-dismissing actions ("Skip the Rest", "Cancel", "Save Note") require a 1.5-second hold barrier with an animated progress bar to prevent accidental actuation. Mouse and keyboard interactions execute immediately on click/keypress.
* **Single-Card State Machine**: Check-in flows present questions sequentially in single-card viewports with 220ms orthogonal transitions, minimizing visual clutter and decision fatigue.
* **Ergonomics & Handedness**: Dynamic positioning shifts drawer anchors and primary action targets to suit right- or left-thumb reach zones.
* **Adaptive Contrast & Color**: CSS custom properties bind directly to `data-theme` and `data-contrast` body attributes for instant, flicker-free accessibility mode switching.

### Backup & Portability

* **JSON Export**: Serializes the entire database snapshot (`config`, `questions`, `logs`) into an uncompressed `.json` file.
* **Import Modes**:
    * **Wipe & Replace**: Completely clears local IndexedDB tables and populates them fresh from the backup payload.
    * **Smart Merge**: Performs non-destructive, timestamp-driven record reconciliation, deduplicating logs and preserving local custom questions.

### Data Model & Storage Schema

Data is partitioned into three dedicated IndexedDB object stores:

1. **`config` Store**: Key-value settings storage:
    * `theme`: `'system'` | `'dark'` | `'light'`
    * `contrast`: `'standard'` | `'high'`
    * `handedness`: `'right'` | `'left'`
    * `onboardingCompleted`: `boolean`

2. **`questions` Store**: Primary key `id` (string):
   ```typescript
   interface Question {
     id: string;
     text: string;
     shortLabel?: string;
     tags?: string[];
     curve: 'more-is-better' | 'less-is-better' | 'middle-is-best';
     responseType: 'scale' | 'boolean'; // 1-5 scale or Yes/No
     minLabel?: string;
     midLabel?: string;
     maxLabel?: string;
     builtIn: boolean;
     archived: boolean;
     order?: number;
   }
   ```

3. **`logs` Store**: Primary key `timestamp` (ISO-8601 string):
   ```typescript
   interface LogEntry {
     timestamp: string; // e.g. "2026-08-14T11:30:00.000Z"
     note?: string | null;
     answers: Array<{
       questionId: string;
       score: number | null; // 1-5 for scale, 1/0 for boolean, null if skipped
       status: 'answered' | 'skipped';
     }>;
   }
   ```

