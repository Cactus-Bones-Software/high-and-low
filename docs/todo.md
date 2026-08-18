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
  - Implement a bright yellow banner with bold black text that informs any user that the version they are looking at is for testing only, and should not be used for psychiatric purposes.
  - Ensure that the banner is easily hidden from the user via changing a single line of CSS.
  - Place the CSS 'testing switch' at the top of `style.css` and signpost it for easy finding by a web-master or developer.

---

### Phase 2: User Interface & Accessibility Refinements
- [x] **Task 2.1: Dynamic System Theme Listener**
  - Extend the theme switcher in `app.js` and `style.css` to listen for system-level dark/light mode preference changes (`window.matchMedia('(prefers-color-scheme: dark)')`).
  - Ensure theme transitions seamlessly when `data-theme="system"` is set without losing border visibility or color contrast.

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
  - Decouple view header typography and layout styling from tracker question presentation.

- [x] **Task 2.10: Seamless View Transitions (Eliminate Screen Blanking)**
  - Fix transition orchestration between views so outgoing and incoming screens slide/crossfade smoothly without blanking or flashing an empty canvas in between.
  - Ensure the incoming view is positioned and rendered before the transition begins, avoiding intermediate empty/unrendered frames.
  - Add automated regression tests to verify view class orchestration and smooth visual continuity.

- [x] **Task 2.11: Suppress Transitions on Initial Load & Page Refreshes**
  - Prevent view and question transition animations from firing during cold loads, theme reloads, or quick browser refreshes.
  - Ensure transitions only trigger on explicit user-initiated navigation events (e.g. drawer link clicks, question submissions, back buttons).
  - Write automated tests to verify that restoring active view or session state on load immediately applies classes without triggering unwanted entry animations.

- [ ] **Task 2.12: Unified Terminology & UI Copy Alignment**
  - Audit and harmonize all user-facing messages, completion screens, dialog prompts, button labels, and screen-reader announcements across `index.html` and `app.js`.
  - Enforce the project taxonomy: standardize on **"Check-In"** for the user action/interaction and **"Entry"** for the stored historical record, removing confusing or conflicting aliases ("Session", "Quiz", "Test", and ambiguous "Log").
  - Ensure completion feedback (e.g. "Check-In recorded. Rest easy.") and navigation cues cleanly reflect this standard without ambiguity.

---

### Phase 3: Analytics & Data Visualization

Patients and psychiatrists need a way to actually read the collected data back, not just record it. This phase adds a line-graph analytics view behind the navigation drawer. Each task below is scoped to a single concern — pull only the task you're working on into context rather than the whole phase.

- [x] **Task 3.1: Question schema — add `shortLabel`**
  - Add a `shortLabel` field (2-3 words) to the question object, separate from the full `text`. Hardcode a `shortLabel` for each of the 7 `DEFAULT_QUESTIONS` in `app.js`.
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
  - A day with no record at all (question wasn't in the active set / didn't exist yet) must also render as a gap, but must be visually distinguishable from a skip if feasible
    - A psychiatrist needs to be able to tell "chose not to answer" from "wasn't asked."

- [x] **Task 3.4b: Intra-day & multi-log timeline scaling + continuous zero-reload check-in flow**
  - Continuous chronological X-axis timeline scaling proportional to elapsed time between check-ins (`(t - t_min) / (t_max - t_min)`), properly rendering multiple check-ins recorded on the same day and irregular multi-day intervals.
  - Adaptive X-axis tick labels and tooltips surfacing hour/minute timestamps for intraday records and clean date labels for multi-day spans.
  - Seamless in-app check-in reset workflow ("Record Another Check-In" on completion screen and automatic reset on returning to Mood Tracker) without requiring page reloads or full PWA restarts.

- [x] **Task 3.5: Colorblind-safe line differentiation**
  - Give each question's line a distinct stroke-dasharray pattern in addition to its color, so no two active lines rely on color alone to be told apart.

- [x] **Task 3.6: Legend checklist — tap to toggle**
  - Build the one/two-column checklist of active questions using their `shortLabel` (Task 3.1), each with a color swatch matching its line.
  - Tapping a row toggles that question's line visibility on the graph. Keep at least one line always visible (never allow toggling to zero).

- [x] **Task 3.7: Legend — long-press to isolate/restore**
  - Holding a legend row (~400-500ms, shorter than the existing 1500ms hold-actions since this isn't a destructive action) isolates the graph to that question alone, hiding all others.
  - Holding the same row again while it's the sole active line restores all questions.

- [x] **Task 3.8: Legend — accessible isolate alternative + quick actions**
  - Add a small per-row icon button that performs the same isolate/restore toggle as Task 3.7's long-press, reachable by click and by keyboard (Enter/Space on focus), since long-press alone is invisible to keyboard and screen-reader users.
  - Add "Show all" / "Clear all" utility buttons above the legend for a fast reset.

- [ ] **Task 3.9: Notes indicator on the graph timeline**
  - Show a small marker under any day that has a non-null `note` field on its log entry (notes are a single string per log, not tied to one question — do not try to plot them as a data series).
  - Tapping the marker reveals the note text.

- [ ] **Task 3.10: Drawer "Restart Check-In" Action**
  - Add a "Restart Check-In" / "Start Over" action within the navigation side drawer to allow users to reset their in-progress check-in back to Question 1 without cluttering the main tracker canvas.
  - Clear active session storage, reset state to Question 1, update tracker view, and close the drawer cleanly.

---

### Phase 4: Question Library & Management

- [ ] **Task 4.1: Database Schema & Default Question Tags**
  - Add `tags` (array of strings, e.g., `["Energy", "Somatic"]`, `["Mood", "Affect"]`) to the question object schema in IndexedDB.
  - Populate default tags for the 7 built-in questions during seeding.

- [ ] **Task 4.2: Setting Alignment — Handedness (`handedness`)**
  - Update settings label/key to `handedness` (`right` default / `left`).
  - Dominant hand dictates menu drawer position (`right` or `left`), and non-dominant hand dictates edit button placement on cards to prevent accidental taps during single-handed use.

- [ ] **Task 4.3: Custom Question Dialog — Tags Field**
  - Add a comma-separated or pill-based Tags input field to the custom question form in `index.html` and wire it into `app.js` save handlers.

- [ ] **Task 4.4: Questions View — Search & Layout Structure**
  - Build the searchable Questions view in `index.html`/`app.js` featuring a search bar that filters questions by title, short label, or tags in real-time.
  - Split the view into two clear visual card sections: **Active in Tracker** (top) and **Question Library Catalog** (bottom).

- [ ] **Task 4.5: Active Tracker Cards & Reordering Handles**
  - Render active tracker question cards with prominent question text at top, tags below, reordering handles/controls (move up / move down or drag handle) to adjust tracker sequence
  - Add an "In Tracker" toggle switch to remove a question into the catalog.

- [ ] **Task 4.6: Library Catalog Cards & Non-Dominant Edit Actions**
  - Render inactive built-in and custom question cards in the library catalog.
  - Position "Edit" buttons on the non-dominant side (based on `handedness` setting).
  - Include an "Add to Tracker" toggle switch on each card to activate questions into the tracker.

- [ ] **Task 4.7: Question Editing & Archiving Workflow**
  - Enable editing of existing custom questions (updating text, short label, tags, curve, and endpoint labels) while maintaining the immutable `id`.
  - Include soft-archive / restore capabilities for custom questions.

- [ ] **Task 4.8: Yes/No Question Type Schema & Authoring**
  - Extend question schema to support response types (`responseType: "scale" | "boolean"` or `curve: "boolean"`).
  - Add response type selector (5-Point Scale vs. Yes/No) to the custom question authoring & editing dialogs in `index.html` and wire it into `app.js`.

- [ ] **Task 4.9: Yes/No Question Tracker UI & Graph Analytics**
  - Update `renderCurrentQuestion` in `app.js` to render a clean 2-button (Yes / No) input deck when `responseType: "boolean"`.
  - Map Yes/No responses to binary score values (or boolean flags) that render accurately on the History line-graph without disrupting standard 1–5 scale questions.

---

### Phase 5: Offline Capabilities & PWA Readiness
- [ ] **Task 5.1: Service Worker Implementation**
  - Create a lightweight vanilla service worker (`sw.js`) to cache static assets (`index.html`, `style.css`, `app.js`, `manifest.json`).
  - Register the service worker inside `app.js` to enable 100% offline functionality.

- [ ] **Task 5.2: Web App Manifest Verification**
  - Verify and complete `manifest.json` with correct relative paths, high-resolution app icons, theme colors (`#121212`), and `display: "standalone"` parameters.

---

### Phase 6: Documentation & Final Cleanup
- [ ] **Task 6.1: Code Base JSDoc & Architectural Comments**
  - Perform a complete documentation pass on `app.js`, adding JSDoc comments to all core functions (`initDatabase`, `renderCurrentQuestion`, `exportAllDataAndConfig`, `handleFileImport`).

- [ ] **Task 6.2: Workspace File Cleanup**
  - Remove any unneeded project boilerplate files (such as `package.json` or `index.js` if created by IDE defaults) and verify the repository remains strictly clean vanilla files.

- [ ] **Task 6.3: Internationalization & Localization Pass**
  - Extract all hardcoded user-facing UI strings across `index.html` and `app.js` into a centralized translation dictionary.
  - Implement language switching and localization readiness for questions, controls, navigation, and settings interface elements.

- [x] **Task 6.4: Shared Test Harness & Helper Utilities**
  - Extract repetitive JSDOM bootstrapping, IndexedDB mocking, matchMedia/serviceWorker polyfills, and helper functions into a centralized `tests/test-utils.js` harness.
  - Refactor all test suites (`drawer.test.js`, `graph.test.js`, `session_persistence.test.js`, `transitions.test.js`) to consume the shared harness, eliminating code duplication and WebStorm inspection warnings.