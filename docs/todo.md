# High & Low — Development Backlog

## Task Backlog

### Phase 1: Storage Layer & Data Safety (IndexedDB Engine)
- [x] **Task 1.1: IndexedDB Fallback & Error Handling**
  - Implement robust browser support checks for `window.indexedDB` inside `app.js`.
  - Add error handling fallbacks so that if IndexedDB is blocked or private browsing prevents access, the user is gracefully alerted rather than experiencing a broken app state.

- [x] **Task 1.2: Advanced Data Merge & De-duplication Logic**
  - Refine `handleFileImport` in `app.js` to handle both `replace` and `merge` modes cleanly.
  - Implement millisecond-level exact matching on incoming log timestamps during merge operations to skip identical duplicates while appending unique historical logs without key collisions.

- [x] **Task 1.3: "Testing only" banner**
  - Implement a bright yellow banner with bold black text that informs any user that the version they are looking at is for testing only and should not be used for psychiatric purposes.
  - Ensure that the banner is easily hidden from the user via changing a single line of CSS.
  - Place the CSS 'testing switch' at the top of `style.css` and signpost it for easy finding by a webmaster or developer.

---

### Phase 2: User Interface & Accessibility Refinements
- [x] **Task 2.1: Dynamic System Theme Listener**
  - Extend the theme switcher in `app.js` and `style.css` to listen for system-level dark/light mode preference changes (`window.matchMedia('(prefers-color-scheme: dark)')`).
  - Ensure the theme transitions seamlessly when `data-theme="system"` is set without losing border visibility or color contrast.

- [x] **Task 2.2: Keyboard & Screen Reader Accessibility Pass**
  - Audit `index.html` to ensure all 1–5 scale buttons, hold actions, and utility triggers have proper `aria-label`, `role="button"`, and tabindex attributes.
  - Add full keyboard navigation support (Arrow keys for score selection, Enter/Space for hold buttons and drawer triggers).

- [x] **Task 2.3: Pastel Palette Refinement for Light Mode**
  - Review color curves in `style.css` under `body[data-theme="light"]`.
  - Ensure "Less is Better", "More is Better", and "Middle is Best" question curves render soft, high-visibility pastel tones instead of dark, low-contrast hex values on light backgrounds.

- [x] **Task 2.4: Handedness Setting (Left/Right Layout Toggle)**
  - Add a user preference setting for Handedness (Right-handed vs. Left-handed) to position the hamburger menu button on either top-right or top-left.
  - Persist handedness preference in `localStorage` and dynamically update the header layout using a `data-handedness` attribute or CSS modifier class.

- [x] **Task 2.5: View Separation — Dedicated Settings View**
  - Refactor the current side drawer into a dedicated `#settings-canvas` view focused strictly on application settings (Theme, Handedness).
  - Ensure smooth navigation transitions into and out of the settings view with correct `aria` and focus management.

- [x] **Task 2.6: View Separation — Dedicated Data Management View**
  - Create a dedicated `#data-canvas` view for all data management tools (Export All Data/Config, Import JSON, Reset Data).
  - Add navigation routing between the main tracker, settings, and data views.

- [x] **Task 2.7: View Separation — Placeholder History View**
  - Create a dedicated `#history-canvas` view scaffold to serve as the landing area for data visualization charts.
  - Provide a clean placeholder interface and navigation entries from the main menu/drawer.

- [x] **Task 2.8: Custom Modal Dialogs & Notice System**
  - Replace native browser popups (`alert`, `confirm`, `prompt`) with custom, accessible `#notice-dialog` and modal dialog components with focus trap and keyboard dismissal.
  - Integrate hold-to-confirm safety delay protection setting for modal and critical action buttons.

- [x] **Task 2.9: Desktop & Landscape Layout Refinement**
  - Refine non-tracker view layouts on desktop and landscape tablet orientations to use a clean vertical hierarchy with compact top header bars above scrollable content panels.
  - Decouple view header typography and layout styling from the tracker question presentation.

- [x] **Task 2.10: Seamless View Transitions (Eliminate Screen Blanking)**
  - Fix transition orchestration between views so outgoing and incoming screens slide/crossfade smoothly without blanking or flashing an empty canvas in between.
  - Ensure the incoming view is positioned and rendered before the transition begins, avoiding intermediate empty/unrendered frames.
  - Add automated regression tests to verify view class orchestration and smooth visual continuity.

- [x] **Task 2.11: Suppress Transitions on Initial Load & Page Refreshes**
  - Prevent view and question transition animations from firing during cold loads, theme reloads, or quick browser refreshes.
  - Ensure transitions only trigger on explicit user-initiated navigation events (e.g., drawer link clicks, question submissions, back buttons).
  - Write automated tests to verify that restoring the active view or session state on a load immediately applies classes without triggering unwanted entry animations.

- [x] **Task 2.12: Unified Terminology & UI Copy Alignment**
  - Audit and harmonize all user-facing messages, completion screens, dialog prompts, button labels, and screen-reader announcements across `index.html` and `app.js`.
  - Enforce the project taxonomy: standardize on **"Check-In"** for the user action/interaction and **"Entry"** for the stored historical record, removing confusing or conflicting aliases ("Session", "Quiz", "Test", and ambiguous "Log").
  - Ensure completion feedback (e.g. "Check-In recorded. Rest easy.") and navigation cues cleanly reflect this standard without ambiguity.

- [x] **Task 2.13: Drawer "Restart Check-In" Action**
  - Add a "Restart Check-In" / "Start Over" action within the navigation side drawer to allow users to reset their in-progress check-in back to Question 1 without cluttering the main tracker canvas.
  - Clear active check-in storage, reset the state to Question 1, update the tracker view, and close the drawer cleanly.

---

### Phase 3: Analytics & Data Visualization

Patients and psychiatrists need a way to actually read the collected data back, not just record it. This phase adds a line-graph analytics view behind the navigation drawer. Each task below is scoped to a single concern — pull only the task you're working on into context rather than the whole phase.

- [x] **Task 3.1: Question schema — add `shortLabel`**
  - Add a `shortLabel` field (2–3 words) to the question object, separate from the full `text`. Hardcode a `shortLabel` for each of the 7 `DEFAULT_QUESTIONS` in `app.js`.
  - Add a "Short label" input to the custom-question authoring form in `index.html`/`app.js`, required alongside the existing text field. Surface it in the live preview.
  - This is a pure data-layer task — no chart or graph code here.

- [x] **Task 3.2: History view scaffold**
  - Add a new `app-canvas` view (`#history-canvas`) reachable from the main drawer, wired into the existing orthogonal-slide transition system.
  - No chart rendering yet — just the empty canvas, navigation entry point, and a query that pulls `logs` + `questions` for the active question set into memory.

- [x] **Task 3.3: Line graph rendering engine**
  - Render one line per active question across its answered scores over time on a single shared 1–5 y-axis, using the `logs` + `questions` data loaded in Task 3.2.
  - Reuse the existing curve-to-color mapping conventions already established for `more-is-better` / `less-is-better` / `middle-is-best` where sensible.

- [x] **Task 3.4: Skipped-vs-absent gap handling in the graph**
  - A `status:"skipped"` record (`score:null`) must render as a visible break in that question's line for that day.
  - A day with no record at all (question wasn't in the active set / didn't exist yet) must also render as a gap, but must be visually distinguishable from a skip.
    - A psychiatrist needs to be able to tell "chose not to answer" from "wasn't asked."

- [x] **Task 3.4b: Intra-day & multi-log timeline scaling + continuous zero-reload check-in flow**
  - Continuous chronological X-axis timeline scaling proportional to elapsed time between check-ins (`(t - t_min) / (t_max - t_min)`), properly rendering multiple check-ins recorded on the same day and irregular multi-day intervals.
  - Adaptive X-axis tick labels and tooltips surfacing hour/minute timestamps for intraday records and clean date labels for multi-day spans.
  - Seamless in-app check-in reset workflow ("Record Another Check-In" on the completion screen and automatic reset on returning to Mood Tracker) without requiring page reloads or full PWA restarts.

- [x] **Task 3.5: Colorblind-safe line differentiation**
  - Give each question's line a distinct stroke-dasharray pattern in addition to its color, so no two active lines rely on color alone to be told apart.

- [x] **Task 3.6: Legend checklist — tap to toggle**
  - Build the one/two-column checklist of active questions using their `shortLabel` (Task 3.1), each with a color swatch matching its line.
  - Tapping a row toggles that question's line visibility on the graph.

- [x] **Task 3.7: Legend — long-press to isolate/restore**
  - Holding a legend row (~400–500 ms, shorter than the existing 1500 ms hold-actions since this isn't a destructive action) isolates the graph to that question alone, hiding all others.
  - Holding the same row again while it's the sole active line restores all questions.

- [x] **Task 3.8: Legend — accessible isolate alternative + quick actions**
  - Add a small per-row icon button that performs the same isolate/restore toggle as Task 3.7's long-press, reachable by click and by keyboard (Enter/Space on focus), since long-press alone is invisible to keyboard and screen-reader users.
  - Add "Show all" / "Clear all" utility buttons above the legend for a fast reset.

- [x] **Task 3.9: Notes indicator on the graph timeline**
  - Show a small marker under any day that has a non-null `note` field on its log entry (notes are a single string per log, not tied to one question — do not try to plot them as a data series).
  - Tapping the marker reveals the note text.

- [x] **Task 3.10: Timeline timeframe presets and responsive horizontal scrolling**
  - Add quick timeframe filter buttons (`7D`, `14D`, `30D`, `90D`, `All`) above the graph to filter the visible date range and zoom into recent check-ins without cognitive clutter.
  - Implement a smooth, touch-friendly horizontal scroll container (`overflow-x: auto`) for dense timelines with a dynamic SVG width based on entry count, ensuring data points and note markers maintain comfortable touch target spacing.
  - Keep the graph accessible with scroll indicators, keyboard navigation, and sticky/frozen Y-axis indicators.

- [x] **Task 3.11: Timeline zoom controls**
  - Add a compact zoom toolbar beside the existing timeframe controls with three buttons: `−` (zoom out), a
    reset-to-default-scale control, and `+` (zoom in).
  - Zoom adjusts horizontal point spacing in `computeGraphLayout()` without changing the active timeframe or filters.
  - Preserve the user's current horizontal scroll anchor when zooming.
  - Use large, keyboard-reachable buttons with clear aria-labels.

---

### Phase 4: Architectural Concerns & Code Modularization

`app.js` has grown to a single ~2,500-line file mixing storage, business logic, and DOM rendering in one global scope,
which makes individual pieces hard to test in isolation. (`tests/test-utils.js` currently has to eval the whole file
into jsdom rather than importing discrete units) It also makes large functions like `renderLineGraph` do too many
unrelated things at once. This phase splits `app.js`into focused ES modules under `public/js/` — no bundler or compiler,
just native `<script type="module">`, staying within the vanilla-only constraint in `AGENTS.md`.

- [x] **Task 4.1: Module scaffold + foundation layer**
  - Create `public/js/` and extract `utils.js` (`escapeHTML`, `safeRAF`), `state.js` (the `STATE` singleton),
  - `storage/db.js` (`initDatabase`, `getAll`, `put`, `getConfig`, `setConfig`, `deleteConfig`, `DB_NAME`, `DB_VERSION`), and `storage/session.js` (`saveActiveCheckin`, `clearActiveCheckin`, `restoreActiveCheckin`, `saveActiveView`, `getStoredActiveView`, related constants).
  - These have no dependencies on other planned modules, so this is the lowest-risk starting point.

- [x] **Task 4.2: Extract `questions.js`**
  - Move `normalizeQuestionText`, `fnv1a32`, `makeCustomId`, `seedDefaults`, `loadActiveQuestions`, `createCustomQuestion`, `getCurveColor`, `getQuestionDashArray`, `DEFAULT_QUESTIONS`, `DEFAULT_ACTIVE_SET`, and `SEED_VERSION` out of `app.js` into `public/js/questions.js`, importing from `storage/db.js`.

- [x] **Task 4.3: Extract `checkin.js`**
  - Move `buildScoreButtonsHTML`, `renderCurrentQuestion`, `clearQuestionTransitions`, `handleScoreSubmission`, `startNewCheckIn`, and `finalizeCheckin` into `public/js/checkin.js`, importing from `state.js`, `storage/db.js`, `storage/session.js`, `questions.js`, and `utils.js`.

- [x] **Task 4.4: Extract `data-io.js`**
  - Move `exportAllDataAndConfig`, `handleFileImport`, `mergeQuestionWithConflictCheck`, `safelyAddEntryWithCollisionCheck`, and `areEntryAnswersIdentical` into `public/js/data-io.js`, importing from `storage/db.js`.

- [x] **Task 4.5: Extract `ui/navigation.js`**
  - Move `navigateTo` into `public/js/ui/navigation.js`, importing from `state.js` and `storage/session.js`. Do this before the other `ui/` modules below, since several of them call `navigateTo`.

- [x] **Task 4.6: Extract `ui/hold-actions.js`**
  - Move `setupHoldActions`, `resetHold`, `executeHoldAction`, and `updateHoldActionAriaLabels` into `public/js/ui/hold-actions.js`, importing from `state.js`.

- [x] **Task 4.7: Extract `ui/dialogs.js`**
  - Move `showNoticeDialog`, `closeNoticeDialog`, `setupNoticeDialog`, `openImportDialog`, `closeImportDialog`, `confirmImport`, `setupImportDialog`, `openNotesDialog`, `closeNotesDialog`, `saveNotesFromDialog`, `setupNotesDialog`, and `updateNotesButtonLabel` into `public/js/ui/dialogs.js`, importing from `data-io.js`, `checkin.js`, and `utils.js`.

- [x] **Task 4.8: Extract `ui/settings-menu.js`**
  - Move `setupSettingsAndMenu`, `setupCanvasBackButtons`, `setInert`, `openDrawer`, `closeDrawer`, `openSettings`, `closeSettings`, `syncMetaThemeColor`, and `applyStoredDisplay` into `public/js/ui/settings-menu.js`, importing from `storage/db.js` and `ui/navigation.js`.

- [x] **Task 4.9: Extract `ui/history-graph.js`**
  - Move `loadHistoryView`, `renderLineGraph`, `formatEntryDateTime`, `formatTickDate`, and `getTimeframeLabel` into `public/js/ui/history-graph.js`, importing from `storage/db.js`, `questions.js`, and `utils.js`.
  - Do not attempt to split `renderLineGraph` internally in this task — that is Task 4.13. This task only moves the file boundary.

- [x] **Task 4.10: Extract `ui/question-authoring.js`**
  - Move `setupQuestionAuthoring` into `public/js/ui/question-authoring.js`, importing from `questions.js` and `storage/db.js`.

- [x] **Task 4.11: Extract `ui/keyboard-navigation.js`**
  - Move `setupKeyboardNavigation` into `public/js/ui/keyboard-navigation.js`, importing from `checkin.js` and `ui/navigation.js`.

- [x] **Task 4.12: Wire up `main.js` and retire `app.js`**
  - Create `public/js/main.js` containing `initApp` and the bootstrap sequence, importing from every module above.
  - Update `index.html` to load `<script src="js/main.js" type="module" defer></script>` in place of `<script src="app.js" defer></script>`, and delete `app.js` once all functions have been migrated.
  - Update the stale `main` field in `package.json` (currently `public/app.js`) to point at `public/js/main.js`.
  - Update `tests/test-utils.js` and all test suites to import directly from the new module files instead of evaluating raw file text into jsdom.
  - Run the full suite (`npm test` / `npx vitest run`) and confirm all existing tests pass unmodified in behavior before marking this task complete.

- [x] **Task 4.13: Split `renderLineGraph` into pure layout + render functions**
  - Within `ui/history-graph.js`, extract a pure `computeGraphLayout()` function (data filtering, timeframe windowing, scale/coordinate math — no DOM access) out of the current `renderLineGraph`, leaving `renderLineGraph`/a new `renderGraphSVG()` responsible only for DOM/SVG string output.
  - This unlocks direct unit testing of the graph math in `tests/graph.test.js` without a jsdom container.

- [x] **Task 4.14: Centralize HTML-escaping discipline**
  - `buildScoreButtonsHTML()`'s `contextLabel` (sourced from a custom question's user-authored `minLabel`/`maxLabel`/`midLabel` fields) is currently inserted into `innerHTML` unescaped, in both the check-in button rendering and the live question-authoring preview — unlike the legend and note-marker code in the history graph, which already calls `escapeHTML()` consistently.
  - Audit every `innerHTML` assignment across the newly split modules and route any interpolated user-authored text (question text, short labels, min/max/mid labels, tags, notes) through `escapeHTML()`. Consider a single small template helper so future render code can't skip it by accident.

- [x] **Task 4.15: Audit silent error handling**
  - Several `catch (_) {}` blocks (around `sessionStorage` reads/writes in check-in/session persistence, pointer-capture calls in hold actions, and `navigator.vibrate`) currently swallow errors with no logging or user-facing signal.
  - Add at minimum a `console.warn` at each swallow point with enough context to debug a user-reported issue, without changing the current fallback behavior (these should stay non-blocking for the user).

---

### Phase 5: Question Library & Management

- [x] **Task 5.1: Database Schema & Default Question Tags**
  - Add `tags` (array of strings, e.g., `["Energy", "Somatic"]`, `["Mood", "Affect"]`) to the question object schema in IndexedDB.
  - Populate default tags for the seven built-in questions during seeding.

- [x] **Task 5.2: Setting Alignment — Handedness (`handedness`)**
  - Update settings label/key to `handedness` (`right` default / `left`).
  - Dominant hand dictates menu drawer position (`right` or `left`), and non-dominant hand dictates edit button placement on cards to prevent accidental taps during single-handed use.

- [x] **Task 5.3: Custom Question Dialog — Tags Field**
  - Add a comma-separated or pill-based Tags input field to the custom question form in `index.html` and wire it into `public/js/ui/question-authoring.js` save handlers.

- [x] **Task 5.4: Questions View — Search, Layout Structure & Add Question Modal**
  - Build the searchable Questions view in `index.html` and `public/js/ui/question-authoring.js`, featuring a search bar that filters questions by full question text, short label, or tags in real time.
  - Split the Questions view into two clear visual card sections:
    - **Active in Tracker** at the top, showing currently active non-archived questions in tracker order.
    - **Question Library Catalog** below, showing inactive non-archived questions.
  - Render read-only question cards for both sections with prominent question text, short label, built-in/custom status, and visible tag chips. Do not add tracker toggles, reordering controls, edit buttons, or archive controls in this task.
  - Replace the inline/bottom-of-list custom question form with a floating action button inside the Questions view.
  - Move the custom question authoring form into an accessible modal dialog opened by the floating action button.
  - Ensure the add-question modal:
    - Uses the existing modal overlay visual pattern.
    - Has `role="dialog"`, `aria-modal="true"`, and an accessible title.
    - Moves focus into the first field when opened.
    - Closes on Cancel and Escape.
    - Returns focus to the floating action button when closed.
    - Resets the form when opened or after a successful save.
  - After saving a custom question, refresh the searchable card lists immediately, close the modal, and show the existing success/restored/duplicate notice flow.

- [ ] **Task 5.5: Active Tracker Cards & Reordering Handles**
  - Render active tracker question cards with prominent question text at top, tags below, reordering handles/controls (move up / move down or drag handles) to adjust the tracker sequence
  - Add an "In Tracker" toggle switch to remove a question into the catalog.

- [ ] **Task 5.6: Library Catalog Cards & Non-Dominant Edit Actions**
  - Render inactive built-in and custom question cards in the library catalog.
  - Position "Edit" buttons on the non-dominant side (based on `handedness` setting).
  - Include an "Add to Tracker" toggle switch on each card to activate questions into the tracker.

- [ ] **Task 5.7: Question Editing & Archiving Workflow**
  - Enable editing of existing custom questions (updating text, short label, tags, curve, and endpoint labels) while maintaining the immutable `id`.
  - Include soft-archive / restore capabilities for custom questions.

- [ ] **Task 5.8: Yes/No Question Type Schema & Authoring**
  - Extend the question schema in `public/js/questions.js` to support response types (`responseType: "scale" | "boolean"` or `curve: "boolean"`).
  - Add response type selector (5-Point Scale vs. Yes/No) to the custom question authoring & editing dialogs in `index.html` and wire it into `public/js/ui/question-authoring.js`.

- [ ] **Task 5.9: Yes/No Question Tracker UI & Graph Analytics**
  - Update `renderCurrentQuestion` in `public/js/checkin.js` to render a clean 2-button (Yes / No) input deck when `responseType: "boolean"`.
  - Map Yes/No responses to binary score values (or boolean flags) that render accurately in `public/js/ui/history-graph.js` without disrupting standard 1–5 scale questions.

---

### Phase 6: Offline Capabilities & PWA Readiness
- [ ] **Task 6.1: Service Worker Implementation**
  - Create a lightweight vanilla service worker (`sw.js`) to cache static assets (`index.html`, `style.css`, `js/*.js`, `manifest.json`).
  - Verify and test service worker registration in `public/js/main.js` to enable 100% offline functionality.

- [ ] **Task 6.2: Web App Manifest Verification**
  - Verify and complete `manifest.json` with correct relative paths, high-resolution app icons, theme colors (`#121212`), and `display: "standalone"` parameters.

---

### Phase 7: Documentation & Final Cleanup
- [ ] **Task 7.1: Code Base JSDoc & Architectural Comments**
  - Perform a complete documentation pass across all modular ES files in `public/js/` (`storage/db.js`, `checkin.js`, `data-io.js`, `questions.js`, `ui/*.js`), adding JSDoc comments to all core functions (`initDatabase`, `renderCurrentQuestion`, `exportAllDataAndConfig`, `handleFileImport`).

- [ ] **Task 7.2: Workspace File Cleanup**
  - Remove any unneeded project boilerplate files (such as `index.js` if created by IDE defaults) and verify the repository remains strictly clean vanilla files.
  - In `package.json`, remove the `dev`/`build` scripts that invoke `vite` — `vite` isn't a declared dependency, and those scripts contradict the "no compilers" stack rule in `AGENTS.md`.

- [ ] **Task 7.3: Internationalization & Localization Pass**
  - Extract all hardcoded user-facing UI strings across `index.html` and `public/js/` modules into a centralized translation dictionary.
  - Implement language switching and localization readiness for questions, controls, navigation, and settings interface elements.

- [x] **Task 7.4: Shared Test Harness & Helper Utilities**
  - Extract repetitive JSDOM bootstrapping, IndexedDB mocking, matchMedia/serviceWorker polyfills, and helper functions into a centralized `tests/test-utils.js` harness.
  - Refactor all test suites (`drawer.test.js`, `graph.test.js`, `session_persistence.test.js`, `transitions.test.js`) to consume the shared harness, eliminating code duplication and WebStorm inspection warnings.
