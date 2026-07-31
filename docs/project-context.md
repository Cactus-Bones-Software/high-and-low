# PROJECT_CONTEXT.md

## Project Overview
* **Name**: High & Low
* **Purpose**: A local-first, zero-friction mood-tracking web application designed specifically for individuals experiencing unipolar or bipolar mood disorders during "lowest of lows" states.

## Tech Stack
* **Frontend Core**: Vanilla HTML5, Vanilla CSS3 (Custom Properties), Vanilla JavaScript (ES6+, zero dependencies/frameworks).
* **Deployment Format**: Progressive Web App (PWA) with offline-first support (`manifest.json` & Service Worker).
* **Local Persistence Engine**: IndexedDB (`HighAndLowDB` v1 with `config` and `logs` object stores).
* **Development Environment**: Isolated Debian VM running WebStorm, integrated with Aider driving local `llama-server` (Qwen2.5-Coder-14B).

## Architectural Rules
* **Local-First & Private**: 100% on-device storage with zero external APIs, backend servers, or analytics.
* **Low Cognitive Load UX**: 1–5 rating scales presented via one-at-a-time sliding card steps with hardware-accelerated 220ms transitions.
* **Data Portability**: Full JSON file backup exporter alongside both "Wipe & Replace" and non-destructive timestamp-driven "Native Merge" import options.
* **Dynamic Accessibility**: Theme switching driven by `data-theme` (`dark`, `light`, `system`) and `data-contrast` (`low`, `high`) body attributes.
* **Minimal UI Surface**: Settings drawer accessed via an orthogonal double-tap gesture on the main header.

## Core Interfaces & Data Schema
* **Active State**: `{ activeQuestions: [], currentQuestionIndex: 0, sessionAnswers: [], deviceMode: 'mouse' }`.
* **Question Object**: `{ id: string, text: string, curve: 'more-is-better'|'less-is-better', minLabel: string, maxLabel: string }`.
* **Log Entry**: `{ timestamp: string, answers: [{ questionId: string, score: number }] }` stored by timestamp key in IndexedDB.

## Non-Goals & Constraints
* **No Medical Advice**: The app strictly records user inputs without generating diagnostic or clinical guidance.
* **No External Dependencies**: No npm packages, frameworks (React/Vue), or build compilers.