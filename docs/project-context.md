# PROJECT_CONTEXT.md

## Project Overview
* **Name**: High & Low
* **Purpose**: A local-first, zero-friction mood tracker for bipolar and unipolar mood cycles (depressive lows & manic highs), optimized for low-energy states.

## Tech Stack
* **Frontend Core**: Vanilla HTML5, Vanilla CSS3 (Custom Properties), Vanilla JavaScript (ES6+, zero dependencies/frameworks).
* **Deployment Format**: Progressive Web App (`manifest.json` present, registration hook for a Service Worker already wired up in `app.js`). Offline asset caching itself (`sw.js`) is not yet implemented — tracked as `docs/todo.md` Phase 5.
* **Local Persistence Engine**: IndexedDB (`HighAndLowDB` v2 with `config`, `entries`, and `questions` object stores).

## Architectural Rules
* **Local-First & Private**: 100% on-device storage with zero external APIs, backend servers, or analytics.
* **Low Cognitive Load UX**: 1–5 rating scales, 220ms orthogonal transitions, "Skip the Rest" escape hatch, stacked full-width touch targets. Yes/No question response type is planned but not yet implemented (`docs/todo.md` Tasks 4.8–4.9).
* **Data Portability**: Full JSON file backup exporter alongside both "Wipe & Replace" and non-destructive timestamp-driven "Smart Merge" import options.
* **Dynamic Accessibility**: Theme switching (`dark`, `light`, `system`), contrast modes (`low`, `high`), and configurable handedness (`right`, `left`).
* **Minimal UI Surface**: Navigation and tools accessed via a slide-out drawer.

## Core Interfaces & Data Schema
* **Active State**: `{ activeQuestions: [], currentQuestionIndex: 0, checkinAnswers: [], checkinNote: null, deviceMode: 'mouse', historyVisibleQuestionIds: null }`.
* **Question Object**: `{ id: string, text: string, originalText: string, shortLabel: string, curve: 'more-is-better'|'less-is-better'|'middle-is-best', minLabel: string|null, maxLabel: string|null, midLabel: string|null, builtIn: boolean, archived: boolean, createdAt: string, updatedAt: string }`. `tags` and `responseType` (`'scale'|'boolean'`) are planned additions, not yet implemented — see `docs/todo.md` Tasks 4.8–4.9.
* **Entry**: `{ timestamp: string, dateString: string, note: string|null, answers: [{ questionId: string, score: number|null, status: 'answered'|'skipped' }] }` stored by ISO timestamp key in the `entries` IndexedDB object store.

## Non-Goals & Constraints
* **No Medical Advice**: The app strictly records user inputs without generating diagnostic or clinical guidance.
* **No External Dependencies**: No npm packages, frameworks (React/Vue), or build compilers.