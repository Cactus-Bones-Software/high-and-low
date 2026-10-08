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

- [ ] **Task 2.14: About, Licence & Thank-You Screen**
  - The README promises an "about section of the app", but no such view exists. Add a dedicated `#about-canvas` view
    reachable from the drawer, following the same navigation, transition, and focus-management pattern as the
    Settings and Data views. This is a high-energy-path view; do not add anything to the tracker canvas.
  - Include: the app name, a plain-language statement that all data stays on the device, the AGPL licence notice
    with a link to the source repository, the "no advertisements, no tracking" statement, donation links
    (GitHub Sponsors, Ko-fi), and the Thank-You list (real-world names only, per the README's donation terms).
  - All copy must use the Check-In / Entry terminology and be written so it can be extracted by Task 8.3.

- [ ] **Task 2.15: Last-Backup Indicator in the Data View**
  - Data lives only on the device and browsers can evict or clear it, so users need to know how stale their backup
    is. Add a `lastBackupAt` config key (ISO-8601 string or `null`), written after a successful export.
  - Show "Last backup: <date>" (or "No backup yet") in the Data view only. Do not add reminders, banners, or badges
    to the tracker canvas (see the two-energy-modes rule in `docs/decisions.md`).
  - Decide whether `lastBackupAt` belongs in the export; it must not break import or merge of older backups.
  - This is an additive config key: update `docs/state.md` and check `docs/versioning.md` for the bump.

- [ ] **Task 2.16: Decide on Safety / Crisis Resources (Developer Decision Required)**
  - This is a decision task. **Stop and ask the developer before implementing anything.** The app is used by people
    in severe lows, and the README already plans a licensed-psychologist review, so the answer may belong to that
    review.
  - Options to put to the developer: (a) no in-app crisis information, (b) a static, clearly labelled "If you need
    urgent help" entry in the drawer or About view, (c) something else.
  - If any resource is added, constrain it: it lives in the high-energy path only, is never triggered or hidden
    based on a user's scores or notes, and is region-aware through the localization system (Task 8.3), since
    hotlines are country-specific.
  - Record the outcome in `docs/decisions.md` (it constrains future work and passes the admission test).

- [ ] **Task 2.17: Selective Backup — Data Layer & Scope Model**
  - Today the only export is `exportAllDataAndConfig()`, which dumps everything. There is no way to back up settings
    without history, or history without settings. Add a scope-aware export in `public/js/data-io.js`, e.g.
    `exportBackup({ includeHistory, includeSettings })`, with at least one scope required. Keep the existing full
    export as the default so the one-tap path never changes.
  - Define the two scopes explicitly and document them in `docs/state.md`:
    - **History**: the `entries` store, plus every question record those entries reference (archived included).
      Entries must always resolve to a question, so a history-only file that omitted questions would leave orphaned
      answers on a fresh device.
    - **Settings**: the question library and `activeQuestionSet` (so a tailored tracker can be carried to a new
      device or shared with a clinician's patients), plus the display preferences (`theme`, `contrast`,
      `handedness`, `holdDelay`, and later `language`).
  - Use an explicit allowlist of exportable config keys. Never export `seedVersion` or `lastBackupAt`; they describe
    the device, not the user's choices.
  - Record the scope in the file (an optional `scope` field such as `["history", "settings"]`), keep
    `exportVersion` readable by the current importer for full backups, and put the scope in the filename
    (`-full`, `-history-only`, `-settings-only`) so users can tell files apart at a glance.
  - `docs/decisions.md` currently says "Never a partial export". Edit that rule (do not append): the default and
    primary export is complete; partial exports are allowed only when explicitly chosen, labelled in the file and
    filename, and never presented as a full backup.
  - Coordinate with Task 2.15: any export that includes history updates `lastBackupAt`; a settings-only export
    does not.
  - Additive schema and file-format change: update `docs/state.md` and check `docs/versioning.md` for the bump.

- [ ] **Task 2.18: Export Dialog with Scope Checkboxes**
  - In the Data view, keep a prominent one-tap **Back Up Everything** button as the primary action. Add a secondary
    **Choose What to Export…** button that opens an accessible modal (same overlay, focus-trap, Escape-to-close, and
    focus-return pattern as the other dialogs) containing two checkboxes, both checked by default:
    "Check-In history" and "Settings & questions". Each has one plain-language line saying what it includes. The
    history line must say that the questions those Check-Ins refer to come along with it.
  - The Export button is disabled, with a visible reason, when neither box is checked. Show a short summary of what
    will be saved ("History only — 142 Entries") so the result is never a surprise.
  - Use ordinary dialog buttons; do not wrap them in the hold-to-confirm barrier (see bug 7.1).
  - The CSV export (Task 3.12) stays a separate button; it serves a different purpose (reading, not restoring).
  - All copy uses Check-In / Entry terminology and is written for extraction by Task 8.3.

- [ ] **Task 2.19: Import Partial Backups Safely**
  - `handleFileImportReaderLoad()` currently rejects any file missing `entries` or `config`, so the files from Task
    2.17 would be refused. Relax validation to: valid JSON, a recognised `exportVersion`, and at least one of
    `entries`, `questions`, or `config` present as an array. Full 2.0 backups must keep importing unchanged.
  - **Wipe & Replace must only clear the stores whose data the file actually contains.** Importing a settings-only
    file in replace mode must never erase history, and importing a history-only file must never reset settings.
    Smart Merge keeps its current rules (entries dedupe on exact timestamp; questions resolve by newest
    `updatedAt`, with the `originalText` collision rule).
  - Show what the file contains in the import dialog ("This file contains: Settings only") before the user
    chooses a mode, and word the Wipe & Replace description to match.
  - On import, ignore `seedVersion` and `lastBackupAt` even if an older file contains them.
  - Tests: full backup round-trip, history-only into a populated device, settings-only into a populated device,
    replace-mode scoping, malformed and empty-array files, and orphan prevention (history-only import brings its
    questions).

- [ ] **Task 2.20: Erase All Data from Inside the App**
  - Task 2.6 lists "Reset Data" for the Data view, but no such control exists; the only way to clear data today is
    to import a file in Wipe & Replace mode, or to clear browser storage by hand. Add an **Erase All Data** action
    in its own clearly separated section at the bottom of the Data view, away from the export and import buttons.
  - Protect it with the existing hold-to-confirm barrier, and make it work even when the `holdDelay` setting is
    disabled (an irreversible action should not be a single stray tap). The confirmation dialog states plainly what
    will be erased, and offers **Back Up First** (a full export) as the first, default-focused option.
  - Erase: the `entries`, `questions`, and `config` stores; the in-progress Check-In and view in `sessionStorage`;
    and the `localStorage` display caches (`handedness`, `holdDelay`, and the legacy `menuSide` if present). Then
    re-seed the built-in questions and default active set and reload into a clean first-run state. Do not touch the
    service worker or its caches; those are app code, not user data.
  - Never leave a half-erased state: perform the IndexedDB clears in one transaction and only reload on its
    successful completion; on failure, show a notice dialog and leave the data intact.
  - Tests: every store and storage key above is empty or re-seeded afterwards, the app starts at Question 1 with
    default settings, and a failed transaction leaves data intact.

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

- [ ] **Task 3.12: CSV Export for Sharing with a Clinician**
  - The README says users can share data with a psychologist, but the only output today is the raw JSON backup,
    which is unreadable for a clinician. Add an "Export as CSV" action to the Data view, kept separate from the
    full JSON backup (which must remain a complete export, per `docs/decisions.md`).
  - One row per Entry with columns for timestamp, date, note, and one column per question (use each question's
    `shortLabel`, including archived questions that have answers). Skipped answers are an empty cell, not-asked
    answers are an empty cell with a distinguishing convention documented in the file header or README, and boolean
    questions are written as `Yes`/`No` using the constants in `questions.js`. Never write `0` or `-1`.
  - Escape notes and labels correctly for CSV, and neutralize spreadsheet formula injection (cells starting with
    `=`, `+`, `-`, or `@`). The file is generated entirely on the device; no network requests.
  - Add tests for quoting, newlines in notes, formula-prefixed notes, skipped vs. not-asked, and boolean output.

- [ ] **Task 3.13: Print-Friendly History View**
  - Add an `@media print` stylesheet for the History view so a user can print or "Save as PDF" the graph for an
    appointment: hide the drawer, toolbars, and floating buttons; show the full graph unclipped and the legend.
  - Notes are currently revealed by tapping a marker, which is invisible on paper. In print output, render a dated
    list of notes (escaped via `escapeHTML()`) beneath the graph.
  - Ensure line differentiation does not rely on colour alone in print (the dash patterns from Task 3.5 must
    survive), since printers are often greyscale.

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
  - Move `setupQuestionAuthoring` into `../public/js/ui/question-view.js`, importing from `questions.js` and `storage/db.js`.

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
  - Add a comma-separated or pill-based Tags input field to the custom question form in `index.html` and wire it into `../public/js/ui/question-view.js` save handlers.

- [x] **Task 5.4: Questions View — Search, Layout Structure & Add Question Modal**
  - Build the searchable Questions view in `index.html` and `../public/js/ui/question-view.js`, featuring a search bar that filters questions by full question text, short label, or tags in real time.
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

- [x] **Task 5.5: Active Tracker Cards & Reordering Handles**
  - Render active tracker question cards with prominent question text at top, tags below, reordering handles/controls (move up / move down or drag handles) to adjust the tracker sequence
  - Add an "In Tracker" toggle switch to remove a question into the catalog.

- [x] **Task 5.6: Catalog Cards & Non-Dominant Edit Actions**
  - Render inactive built-in and custom question cards in the library catalog.
  - Position "Edit" buttons on the non-dominant side (based on `handedness` setting).
  - Include an "Add to Tracker" toggle switch on each card to activate questions into the tracker.

- [x] **Task 5.7: Question Editing & Archiving Workflow**
  - Enable editing of existing custom questions (updating text, short label, tags, curve, and endpoint labels) while maintaining the immutable `id`.
  - Include soft-archive / restore capabilities for custom questions.

- [x] **Task 5.8: Removed Questions**
  - Place all removed questions into a normally hidden section of the question catalog.
  - Create a "Show|Hide Removed Questions" button at the bottom of the main catalog that shows and hides the removed questions below it.
    - Do not add a section header for the removed question.
  - Change "Archive Question" button to say "Remove Question".
  - Ensure search only shows removed questions if the removed question section is being shown.

- [x] **Task 5.9: Built In Question Copying
  - Change the edit button for a built-in question to be a 'Copy' button that opens a pre-filled dialog with all the same information as the built-in question.
  - If the user attempts to save the question without making important changes, like to the text of the question, ensure that the save fails, and the reason is clear to the user.
    - Save button should wiggle
    - A short, informative message should display explaining what needs to be changed.
    - Fields that should be changed should have a red outline.
    - The form should scroll to the first field that needs changed.

- [x] **Task 5.10.1: Yes/No Question Type — Schema Field**
  - In `public/js/questions.js`, add a `responseType` field to the question schema (`"scale" | "boolean"`).
  - Default every entry in `DEFAULT_QUESTIONS` to `responseType: "scale"` explicitly (do not rely on `undefined`).
  - In `createCustomQuestion`, accept an optional `responseType` argument, validate it against the two allowed
    values, default to `"scale"` when omitted, and persist it on both create and the existing restore-from-archive
    path.
  - In `seedDefaults`, backfill `responseType: "scale"` onto any existing stored question record that predates this
    field, the same way `shortLabel`/`tags` are currently backfilled.
  - This is a pure data-layer task — no dialog markup or UI wiring here. Do not touch `index.html` or
    `question-view.js`.

- [x] **Task 5.10.2: Yes/No Question Type — Authoring Dialog Field**
  - In `index.html`, add a response type selector (5-Point Scale vs. Yes/No) to the custom question authoring modal
    markup (the same modal used for both add and edit, per Task 5.9), using the existing form-field/label
    conventions already used for the curve selector (`#q-curve`).
  - When "Yes/No" is selected, hide the scale-only fields that don't apply to a boolean question (curve selector,
    min/mid/max endpoint label inputs) from view; when "5-Point Scale" is selected, show them again. Pure
    show/hide markup and inline behavior only — do not wire this into save/load logic yet, that is Task 5.10.3.
  - Reflect the selected response type in the live question preview element.

- [x] **Task 5.10.3: Yes/No Question Type — Wire Selector Into Save/Edit**
  - In `../public/js/ui/question-view.js`, read the new response type selector's value on save and pass it through
    to `createCustomQuestion` (Task 5.10.1) as `responseType`.
  - When opening the dialog to edit an existing custom question, populate the selector from that question's stored
    `responseType` and apply the same show/hide behavior from Task 5.10.2 immediately on open (not just on
    subsequent `change` events).
  - Confirm the field-hiding behavior from Task 5.10.2 is correctly triggered both by user interaction and by the
    programmatic population step above.

- [x] **Task 5.11.1: Boolean Score Mapping Constants**
  - In `public/js/questions.js`, add two exported constants for how a boolean answer is stored as a score on the
    existing 1–5 scale, e.g. `BOOLEAN_NO_SCORE = 1` and `BOOLEAN_YES_SCORE = 5`. Answers persist as the mapped
    number, not as a separate `true`/`false` field, so every existing `score`-based read path (`handleScoreSubmission`,
    `history-graph.js`'s `getY()`/grid lines/skip handling) keeps working unchanged for `responseType: "boolean"`
    questions with zero additional branching there.
  - This is the single source of truth for the mapping — Tasks 5.11.2 and 5.11.4 both import these constants rather
    than hardcoding `1`/`5` again.

- [x] **Task 5.11.2: Yes/No Tracker Input Deck**
  - Update `renderCurrentQuestion` and `buildScoreButtonsHTML` in `public/js/checkin.js` so that when the current
    question has `responseType: "boolean"`, a clean 2-button (Yes / No) input deck renders in place of the 5-button
    scale deck.
  - Wire both buttons to the existing `handleScoreSubmission(questionId, score)` call, passing
    `BOOLEAN_YES_SCORE`/`BOOLEAN_NO_SCORE` from Task 5.11.1 — no changes to `handleScoreSubmission` itself or to
    check-in persistence/transition logic are needed.

- [x] **Task 5.11.3: Boolean Line Rendering — Step Interpolation**
  - In `public/js/ui/history-graph.js`, change the segment-to-`<path>` construction so that a `responseType: "boolean"`
    question's line draws as a horizontal-then-vertical step between consecutive answered points, instead of the
    diagonal straight line currently produced for every question — a diagonal implies in-between values a Yes/No
    answer never has.
  - Standard `responseType: "scale"` questions must render exactly as before; this only changes the `pathData`
    construction taken for boolean series.

- [x] **Task 5.11.4: Boolean Point Tooltips & Accessible Labels**
  - In the same point-circle rendering block in `public/js/ui/history-graph.js`, replace the `Score ${point.score}/5`
    wording in the `aria-label` and `<title>` tooltip text with `Yes`/`No` (via the Task 5.11.1 constants) whenever
    the point belongs to a `responseType: "boolean"` question, so a psychiatrist reading a tooltip never sees a raw
    `1`/`5` for a question that was never actually a 5-point scale.
  - Scale-question tooltips keep their current `Score X/5` wording unchanged.
---


### Phase 6: Offline Capabilities & PWA Readiness
- [x] **Task 6.1: Service Worker Implementation**
  - Create a lightweight vanilla service worker (`sw.js`) to cache static assets (`index.html`, `style.css`, `js/*.js`, `manifest.json`).
  - Verify and test service worker registration in `public/js/main.js` to enable 100% offline functionality.

- [x] **Task 6.2: Web App Manifest Verification**
  - Verify and complete `manifest.json` with correct relative paths, high-resolution app icons, theme colors (`#121212`), and `display: "standalone"` parameters.

- [x] **Task 6.3: Service Worker Lifecycle & PWA Update Handling**
  - Listen for service worker state changes and `controllerchange` events in `public/js/main.js` to automatically prompt users or reload active tabs when app updates deploy.
  - Implement app lifecycle re-checks (`visibilitychange` / `registration.update()`) to force fresh update checks when the installed PWA resumes from background states.

- [ ] **Task 6.4: Precache List Integrity Test**
  - `PRECACHE_ASSETS` in `sw.js` is maintained by hand, and `CACHE_NAME` is bumped by hand, so a forgotten file or
    bump leaves offline users on stale or missing assets. Add a Vitest test that fails if any file under
    `public/js/` (and `index.html`, `style.css`, `manifest.json`, and the `icons/` files referenced by the manifest
    and HTML) is missing from `PRECACHE_ASSETS`, or if any listed path does not exist on disk.
  - Document the `CACHE_NAME` bump rule (when it must change) in `docs/state.md` next to the `sw.js` entry.
  - Do the cleanup in bug 7.4 first or in the same edit, otherwise this test will fail on the nonexistent paths.

- [ ] **Task 6.5: Request Persistent Storage**
  - Browsers may evict IndexedDB for sites that are not installed or are under storage pressure. After the first
    successfully saved Check-In (not on page load), call `navigator.storage.persist()` if available and not already
    granted. Never show a blocking prompt of our own; browsers that ask for permission do so themselves.
  - Failure or unsupported browsers must be silent to the user and logged with `console.warn` (per Task 4.15).
  - Show the persistence status ("Storage protected" / "Storage not protected: back up regularly") in the Data view
    only, next to the Task 2.15 backup indicator.

---

### Phase 7: Bugs and Issues

- [ ] **7.1**: Buttons in dialogs sometimes have the hold-to-actuate effect, even if they do not need to be held.

- [ ] **7.2**: The viewport meta tag in `index.html` sets `maximum-scale=1.0, user-scalable=no`, which blocks
  browser zoom for low-vision users (fails WCAG 1.4.4 Resize Text) in an app that has accessibility as a core
  principle. Remove those restrictions. Confirm the graph's own pinch-zoom (Tasks 9.7–9.10) still works without
  triggering page zoom by relying on `touch-action` on `.graph-scroll-container`, and add a test or documented
  manual check for it.

- [ ] **7.3**: There is no `prefers-reduced-motion` handling anywhere in `style.css`. Add a
  `@media (prefers-reduced-motion: reduce)` block that removes or minimizes view slides, question transitions, the
  save-button wiggle, and graph animations. Ensure any JS that waits on `transitionend` or a timer still completes
  its work when transitions are disabled (otherwise views or questions could get stuck). Add a test alongside
  `tests/transitions.test.js`.

- [ ] **7.4**: `PRECACHE_ASSETS` in `sw.js` lists root-level icon paths (`./favicon.ico`, `./favicon.png`,
  `./apple-touch-icon.png`, `./pwa-*.png`) that do not exist; the icons live in `./icons/`. They fail silently in the
  install handler's `try/catch`, hiding real precache failures. Remove the nonexistent entries and confirm offline
  start still works. Bump `CACHE_NAME`.

### Phase 8: Documentation & Final Cleanup
- [x] **Task 8.1: Code Base JSDoc & Architectural Comments**
  - Perform a complete documentation pass across all modular ES files in `public/js/` (`storage/db.js`, `checkin.js`, `data-io.js`, `questions.js`, `ui/*.js`), adding JSDoc comments to all core functions (`initDatabase`, `renderCurrentQuestion`, `exportAllDataAndConfig`, `handleFileImport`).

- [x] **Task 8.2: Workspace File Cleanup**
  - Remove any unneeded project boilerplate files (such as `index.js` if created by IDE defaults) and verify the repository remains strictly clean vanilla files.
  - In `package.json`, remove the `dev`/`build` scripts that invoke `vite` — `vite` isn't a declared dependency, and those scripts contradict the "no compilers" stack rule in `AGENTS.md`.

- [ ] **Task 8.3: Internationalization & Localization Pass**
  - Extract all hardcoded user-facing UI strings across `index.html` and `public/js/` modules into a centralized translation dictionary.
  - Implement language switching and localization readiness for questions, controls, navigation, and settings interface elements.

  - [x] **Task 8.3.1: Localization Design Decision — Built-In Question Translation (Developer Decision Required)**
    - Do this before or at the start of Task 8.3. **Stop and ask the developer.** `docs/decisions.md` says question
      `id` and `originalText` are immutable and custom IDs are hashes of `originalText`, so translating built-in
      questions by overwriting stored `text` would violate the model.
    - Proposal to confirm: built-in questions resolve their `text`, `shortLabel`, and endpoint labels from translation
      keys at render time (keyed by `id`), while custom and user-edited questions display their stored text
      untranslated. Decide what happens when a user has edited a built-in's copy, what backups contain, and whether
      `SEED_VERSION` needs a bump.
    - Record the outcome in `docs/decisions.md` and the schema impact in `docs/state.md`.

  - [ ] **Task 8.3.2: Locale-Aware Dates and Document Language**
    - `formatEntryDateTime`, `formatTickDate`, and related helpers in `ui/history-graph.js` use no `Intl` APIs. Route
      all date/time display (graph ticks, tooltips, note markers, Data view dates) through `Intl.DateTimeFormat` using
      the active locale.
    - Keep `<html lang>` and `dir` in sync with the selected language at startup and on language change.
    - Add tests for at least two locales, including a different date order and 12/24-hour convention.

  - [ ] **Task 8.3.3: Localize Static Files and Offline Caching**
    - `index.html` `<title>` and meta description, the testing banner, and `manifest.json` `name`/`description` are
      not reachable by the translation dictionary. Localize `<title>` and the banner from JS, and decide (and
      document in `docs/state.md`) how the single `manifest.json` is handled (default-locale only, or per-locale files).
    - Add every locale file to `PRECACHE_ASSETS` in `sw.js` and bump `CACHE_NAME`. This must pass the Task 6.4 test.
    - Persist the chosen language as a new `language` config key (mirror it in `localStorage` for pre-render access,
      like `handedness`); update `docs/state.md` and check `docs/versioning.md`.

  - [ ] **Task 8.3.4: Translation Glossary and Key-Parity Test**
    - Add a short glossary (in `docs/`) fixing the translation of "Check-In" and "Entry" per language, since the
      terminology rule in `docs/decisions.md` is written in English. "Session", "Quiz", "Test", and "Log" equivalents
      remain forbidden in every language.
    - Locales are JSON-only (see `docs/decisions.md`); the test reads every locale listed in
      `public/locales/manifest.json`.
    - Add a test asserting that every locale defines exactly the same keys as the default locale, that no value is
      empty, and that interpolation placeholders match across locales.

  - [ ] **Task 8.3.5: Right-to-Left Layout Review (Only When an RTL Locale Is Added)**
    - Convert physical CSS properties (`margin-left`, `left`, `text-align: left`, etc.) to logical ones where needed.
    - Decide whether `handedness` stays a physical left/right setting under RTL (it should, because it describes the
      user's hand, not reading direction) and verify the menu, edit buttons, and graph axes still behave correctly.
    - Do not start this until an RTL locale actually exists.

- [x] **Task 8.4: Shared Test Harness & Helper Utilities**
  - Extract repetitive JSDOM bootstrapping, IndexedDB mocking, matchMedia/serviceWorker polyfills, and helper functions into a centralized `tests/test-utils.js` harness.
  - Refactor all test suites (`drawer.test.js`, `graph.test.js`, `session_persistence.test.js`, `transitions.test.js`) to consume the shared harness, eliminating code duplication and WebStorm inspection warnings.

- [ ] **Task 8.5: Rename `STATE.historyTimeRange` to Reflect Zoom-Preset Semantics**
  - Timeframe filtering was retired (Tasks 9.2–9.3), but `STATE.historyTimeRange` (`public/js/state.js`) still uses
    the filter-era name and the `'7d' | '14d' | '30d' | '90d' | 'all'` comment. It now records only which zoom-preset
    button is active.
  - Rename it to something accurate (e.g. `historyActiveZoomPreset`) in `state.js`, `ui/history-graph.js`,
    `tests/graph.test.js`, and `tests/test-utils.js`. Keep behavior identical.
  - Update the `STATE` block in `docs/state.md` in the same edit so the field name and comment match the code.

- [ ] **Task 8.6: Retire Legacy `menuSide` Config Fallback**
  - `handedness` replaced `menuSide` (the 2026-08-13 handedness decision), but `ui/settings-menu.js` still reads
    `getConfig('menuSide')` and `localStorage 'menuSide'` as fallbacks, and `tests/handedness.test.js` (test 5)
    covers them.
  - Decide whether to migrate on load (copy any existing `menuSide` value into `handedness`, then delete the legacy
    key from IndexedDB and `localStorage`) or drop the fallback outright. Removing it without migrating would
    silently reset handedness for existing users, so a one-time migration is the safer default.
  - Remove the fallback reads, update or replace the backward-compatibility test, and confirm `docs/state.md` lists
    only `handedness` (it already does).
  - Note: deleting a stored config key is a schema/config change, so check `docs/versioning.md` for whether a bump
    is needed.

- [ ] **Task 8.7: Verify `decisions.md` Against the Code and Tests**
  - `docs/decisions.md` was rewritten as standing constraints rather than a dated log. Confirm that each rule matches
    current behavior, and that each `(Enforced in: ...)` reference points at a real test.
  - Add tests for any rule that has no enforcement (candidates: the `score: 0` / `-1` sentinel ban, the
    `SEED_VERSION` bump requirement, the no-hard-delete rule for questions, and export including archived questions).
  - Remove or correct any rule the code does not follow, or record the discrepancy as a bug in Phase 7.


- [ ] **Task 8.8: Documentation Consistency Pass**
  - Fix contradictions between the docs and the code or each other, verifying against the code each time:
    - `docs/dataset-guidelines.md` schema is outdated: no `originalText`, `tags`, or `responseType`; uses `menuSide`
      and `contrast: "low"`; shows `seedVersion: 3`.
    - `docs/state.md` calls `decisions.md` "append-only"; `docs/versioning.md` says it "logs rationale for bumps".
      Both contradict `AGENTS.md` and the header of `decisions.md`.
    - `docs/state.md` lists `question_copying.test.js`; the real file is `question-copying.test.js`.
    - `docs/state.md` documents `contrast` as `'standard'` or `'high'`, but `index.html` uses `data-contrast="low"`.
      Determine which is correct, and fix the docs or file a bug in Phase 7.
    - `biome.json` uses `lineWidth: 100`; `AGENTS.md` specifies a 120-column limit. Align them.
    - `docs/todo.md`: Task 5.9 has broken bold markup; Phase 8 appears before Phase 9; Task 8.4 references a
      nonexistent `session_persistence.test.js`; several older tasks still mention `app.js` and `logs` where the code
      now uses modules and `entries`.
  - Docs-only change; no version bump.

- [ ] **Task 8.9: Record Product Non-Goals in `decisions.md` (Developer Decision Required)**
  - **Ask the developer which of these are permanent non-goals** before writing anything: push notifications or
    reminders, accounts or cloud sync (the README says others may fork for this), analytics or telemetry of any
    kind, and advertising.
  - For each confirmed item, add a standing-constraint entry to `docs/decisions.md` in the existing
    **Rule.** Why. format, so future agents stop and ask rather than re-litigating it.

- [ ] **Task 8.10: CI — Run Tests and Lint Before Deploy**
  - `.github/workflows/static.yml` deploys `public/` to Pages on every push to `main` without running `npm test` or
    `npm run lint`. Add a workflow (or a prior job in the same one) that runs `npm ci`, `npm run lint`, and
    `npm test`, also on pull requests, and make the deploy job depend on it.
  - Dev dependencies are acceptable here; do not introduce any runtime dependency or build step for `public/`.

- [ ] **Task 8.11: Repository Community and Policy Files**
  - Add a `SECURITY.md` (how to report a vulnerability or a privacy issue) and a `CONTRIBUTING.md` that points to
    `AGENTS.md`, `docs/decisions.md`, and the donation terms ("donors have no influence on development").
  - Add a plain-language privacy statement (what is stored, where, that nothing is transmitted) and link it from
    the README and the Task 2.14 About view.

- [ ] **Task 8.12: Custom Domain Setup**
  - The README reserves `high-and-low.app` (primary) and `highandlow.app` (secondary). Add a `public/CNAME` file,
    document the DNS and GitHub Pages settings steps, and configure the secondary domain to redirect to the primary.
  - Verify the service worker scope, `manifest.json` `start_url`, and all asset paths still work on both the domain
    root and the old sub-path (per the relative-path convention in `AGENTS.md`).

- [ ] **Task 8.13: 1.0 Readiness Checklist**
  - Track the prerequisites in `docs/versioning.md` as concrete steps: remove the testing banner (Task 1.3 switch in
    `style.css`), declare the `HighAndLowDB` schema and backup format stable with a documented migration policy,
    confirm Tasks 7.1–7.4 are closed, and confirm the About, privacy, and safety-resource decisions (Tasks 2.14,
    2.16, 8.11) are done.
  - Note the professional mental-health and accessibility reviews from the README as recommended, and decide
    explicitly whether they block 1.0.
  - Do not bump to 1.0.0 as part of this task; it only produces the checklist.


### Phase 9: History View — Uniform Time-Scale Rendering & Gesture Zoom

Design context: the graph currently sizes its total width from `(entryCount - 1) * pointSpacing` (a fixed
pixel reservation per *entry*), while placing each point by its real elapsed *time* — two unrelated rulers
layered on top of each other. For bursty/clustered data this produces large blank stretches of genuinely
empty, unlabeled canvas at the graph's edges, and lets the scroll container scroll into that blank space.
The tasks below replace this with a single, uniform pixels-per-unit-of-time scale that both native scroll
and zoom operate on consistently, and add continuous gesture-driven zoom on top of it.

- [x] **Task 9.1: Uniform Time-to-Pixel Scale Constant**
  - In `public/js/ui/history-graph.js`, replace the entry-count-driven width formula in `computeGraphLayout()`
    (`(entryCount - 1) * pointSpacing`) with a single exported base-scale constant expressed as pixels per unit
    of real elapsed time (e.g. pixels per hour).
  - Every point's x-position must derive purely from `(entryTime - originTime) * scale`, at the current zoom
    level — not from entry index or entry count. This is the single source of truth the rest of Phase 9 builds
    on; keep it a plain exported constant so it stays easy to tune later without touching call sites.
- [x] **Task 9.2: Retire Timeframe-Based Entry Filtering**
  - In `computeGraphLayout()`, remove the `timeRange` cutoff filtering (`filteredEntries` windowing for
    `7d`/`14d`/`30d`/`90d`/`all`). The full entry history is always included in the rendered/scrollable domain;
    nothing is excluded from the DOM based on a selected range anymore — users navigate to what they want to see
    themselves, by panning and zooming.
  - Update `tests/graph.test.js` (and any other suite asserting on `timeRange`/`filteredEntries` windowing
    behavior) to match the new always-render-everything model.
- [x] **Task 9.3: Repurpose Timeframe Buttons as Zoom-Neighborhood Presets**
  - Change the behavior wired to the existing 7D/14D/30D/90D/All buttons: instead of filtering entries out of
    the render (retired in Task 9.2), clicking one sets the current zoom scale such that the specified number of days
    fill the current viewport width, pivoting the zoom around the horizontal center of the currently visible range (not
    jumping to a fixed window or changing what's rendered).
  - Update the buttons' visible labels and `aria-label`s, since "Last 7 days" framing no longer applies — they
    are now scale shortcuts ("Zoom to ~7 days"), not data filters.
- [x] **Task 9.4: Zoom Buttons — Pivot on Viewport Center, No Clamp**
  - Update the existing `+`/`−` zoom buttons to scale the Task 9.1 time-to-pixel rate around the horizontal
    center of the *currently visible viewport* (not the whole SVG's midpoint), replacing the current
    index-based `pointSpacing` multiplier entirely.
  - Remove the existing `0.5`–`3` zoom clamp (`isZoomOutDisabled`/`isZoomInDisabled`) — zoom range is unbounded
    in both directions now that Task 9.5's `NOW` button guarantees the user always has a way back to a known,
    labeled position.
- [x] **Task 9.5: `NOW` Return Button**
  - Add a `NOW` button to the graph header controls (`.graph-header-controls`) that pans — does not change
    zoom scale — the scroll position so the most recent entry sits at its normal position with the Task 9.6
    trailing padding, from any current pan/zoom state.
- [x] **Task 9.6: Fixed Leading/Trailing Time Padding**
  - Initially implemented in 0.3.1 with 7-day timeline padding, then refined in 0.3.3 and 0.3.4: replaced hardcoded
    SVG-space time padding with CSS-based viewport padding (`scroll-padding-inline: 10%` on container, `10%` inline
    padding on `.graph-scroll-content`) and tight SVG bounding to prevent zoom-scaled dead space.
- [x] **Task 9.7: Live Gesture Zoom — Pinch & Ctrl+Scroll Input Handling**
  - On `.graph-scroll-container`, wire touch pinch gestures (two-pointer `pointermove` distance tracking) and
    desktop `wheel` events with `ctrlKey`/`metaKey` held (covers both Ctrl+scroll-wheel and trackpad pinch, which
    browsers report as `wheel` + `ctrlKey`) to a live zoom interaction, distinct from the discrete Task 9.4
    buttons.
  - Track gesture start/move/end state and compute a live scale factor relative to gesture start, pivoted at the
    gesture's current midpoint (touch) or cursor position (wheel/trackpad).
- [x] **Task 9.8: Live Gesture Zoom — CSS Transform Rendering Pass**
  - During an active gesture (Task 9.7), apply `transform: scaleX(...)` plus a compensating `translateX(...)` to
    keep the pivot point visually fixed, directly to the rendered SVG/graph group via CSS only — no
    `computeGraphLayout()` recomputation, no `container.innerHTML` rebuild, no listener rebinding — for smooth,
    low-latency visual response every frame.
- [x] **Task 9.9: Live Gesture Zoom — Per-Frame Counter-Scale for Points & Text**
  - On each animation frame during an active gesture, apply an inverse counter-scale to point circles and text
    elements (score gridline labels, date tick labels) relative to the Task 9.8 group transform, so they stay
    visually round/upright and don't stretch or smear with the surrounding horizontal scale.
  - Apply `vector-effect="non-scaling-stroke"` to plotted lines and point circles so stroke width and dash
    patterns also stay visually consistent under the live transform, independent of the counter-scale pass.
- [x] **Task 9.10: Live Gesture Zoom — Commit on Gesture End**
  - When a gesture ends (last touch pointer lifts, or wheel/trackpad gesture stops), run a single real
    `computeGraphLayout()` + redraw pass at the settled scale, then reset the live CSS transform (Task 9.8) and
    counter-scale (Task 9.9) to identity.
  - The legend, timeframe/zoom toolbars, guide key, and note-marker listeners must remain untouched (not
    rebuilt, not rebound) for the entire gesture lifecycle — only the graph/point/text elements are touched, and
    only once per full gesture, not per frame.