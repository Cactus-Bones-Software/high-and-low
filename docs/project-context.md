# PROJECT_CONTEXT.md

## Project Overview
* **Name**: High & Low
* **Purpose**: A local-first, zero-friction mood tracker for bipolar and unipolar mood cycles (depressive lows & manic highs), optimized for low-energy states.

## Tech Stack
* **Frontend Core**: Vanilla HTML5, Vanilla CSS3 (Custom Properties), Vanilla JavaScript (ES6+, zero dependencies/frameworks).
* **Deployment Format**: Progressive Web App (PWA) with offline-first support (`manifest.json` & Service Worker).
* **Local Persistence Engine**: IndexedDB (`HighAndLowDB` v2 with `config`, `logs`, and `questions` object stores).

## Architectural Rules
* **Local-First & Private**: 100% on-device storage with zero external APIs, backend servers, or analytics.
* **Low Cognitive Load UX**: 1–5 rating scales & Yes/No choices, 220ms orthogonal transitions, "Skip the Rest" escape hatch, stacked full-width touch targets.
* **Data Portability**: Full JSON file backup exporter alongside both "Wipe & Replace" and non-destructive timestamp-driven "Native Merge" import options.
* **Dynamic Accessibility**: Theme switching (`dark`, `light`, `system`), contrast modes (`low`, `high`), and configurable handedness (`right`, `left`).
* **Minimal UI Surface**: Navigation and tools accessed via a slide-out drawer.

## Core Interfaces & Data Schema
* **Active State**: `{ activeQuestions: [], currentQuestionIndex: 0, sessionAnswers: [], deviceMode: 'mouse' }`.
* **Question Object**: `{ id: string, text: string, shortLabel?: string, tags?: string[], curve: 'more-is-better'|'less-is-better'|'middle-is-best', responseType?: 'scale'|'boolean', minLabel?, maxLabel?, midLabel?, builtIn: boolean, archived: boolean }`.
* **Log Entry**: `{ timestamp: string, answers: [{ questionId: string, score: number|null, status: 'answered'|'skipped' }] }` stored by ISO timestamp key in IndexedDB.

## Non-Goals & Constraints
* **No Medical Advice**: The app strictly records user inputs without generating diagnostic or clinical guidance.
* **No External Dependencies**: No npm packages, frameworks (React/Vue), or build compilers.