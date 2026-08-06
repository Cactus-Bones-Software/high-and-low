# High & Low — Development TODO & Agent Operating Protocol

## Agent Execution Methodology & Guidelines

You are an autonomous software developer working on "High & Low", a local-first, low-friction mood tracking web application built strictly with vanilla HTML, CSS, and JavaScript (no frameworks, compilers, or external dependencies).

### Core Directives for the Agent:
1. **Single Task Focus:** Execute **ONE single unchecked task (`[ ]`) at a time**. Do NOT move to the next task or combine multiple tasks into a single edit session.
2. **Local-First & Zero Friction:** Maintain extreme care for the user experience. The app is targeted at people in severe mental fatigue or low states—keep animations snappy (<250ms), UI controls large and accessible, and external dependencies at zero.
3. **Completion Workflow:**
  - Implement the requested code or architectural change for the selected task.
  - Test/verify the functionality within the bounds of the vanilla HTML/CSS/JS files (`index.html`, `style.css`, `app.js`).
  - Mark the completed task as `[x]` in this `todo.md` file.
  - Prompt the developer/user to inspect the change before proceeding to the next item.

---

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
- [ ] **Task 2.1: Dynamic System Theme Listener**
  - Extend the theme switcher in `app.js` and `style.css` to listen for system-level dark/light mode preference changes (`window.matchMedia('(prefers-color-scheme: dark)')`).
  - Ensure theme transitions seamlessly when `data-theme="system"` is set without losing border visibility or color contrast.

- [ ] **Task 2.2: Keyboard & Screen Reader Accessibility Pass**
  - Audit `index.html` to ensure all 1–5 scale buttons, hold actions, and utility triggers have proper `aria-label`, `role="button"`, and tabindex attributes.
  - Add full keyboard navigation support (Arrow keys for score selection, Enter/Space for hold buttons and drawer triggers).

- [ ] **Task 2.3: Pastel Palette Refinement for Light Mode**
  - Review color curves in `style.css` under `body[data-theme="light"]`.
  - Ensure "Less is Better", "More is Better", and "Middle is Best" question curves render soft, high-visibility pastel tones instead of dark, low-contrast hex values on light backgrounds.

---

### Phase 3: Analytics & Data Visualization

Patients and psychiatrists need a way to actually read the collected data back, not just record it. This phase adds a line-graph analytics view behind the settings drawer. Each task below is scoped to a single concern — pull only the task you're working on into context rather than the whole phase.

- [ ] **Task 3.1: Question schema — add `shortLabel`**
  - Add a `shortLabel` field (2-3 words) to the question object, separate from the full `text`. Hardcode a `shortLabel` for each of the 7 `DEFAULT_QUESTIONS` in `app.js`.
  - Add a "Short label" input to the custom-question authoring form in `index.html`/`app.js`, with a low character cap, required alongside the existing text field. Surface it in the live preview.
  - This is a pure data-layer task — no chart or graph code here.

- [ ] **Task 3.2: Analytics view scaffold**
  - Add a new `app-canvas` view (e.g. `#analytics-canvas`) reachable from the settings drawer, wired into the existing orthogonal-slide transition system.
  - No chart rendering yet — just the empty canvas, navigation entry point, and a query that pulls `logs` + `questions` for the active question set into memory.

- [ ] **Task 3.3: Line graph rendering engine**
  - Render one line per active question across its answered scores over time on a single shared 1–5 y-axis, using the `logs` + `questions` data loaded in Task 3.2.
  - Reuse the existing curve-to-color mapping conventions already established for `more-is-better` / `less-is-better` / `middle-is-best` where sensible.

- [ ] **Task 3.4: Skipped-vs-absent gap handling in the graph**
  - A `status:"skipped"` record (`score:null`) must render as a visible break in that question's line for that day.
  - A day with no record at all (question wasn't in the active set / didn't exist yet) must also render as a gap, but must be visually distinguishable from a skip if feasible — a psychiatrist needs to be able to tell "chose not to answer" from "wasn't asked."

- [ ] **Task 3.5: Colorblind-safe line differentiation**
  - Give each question's line a distinct stroke-dasharray pattern in addition to its color, so no two active lines rely on color alone to be told apart.

- [ ] **Task 3.6: Legend checklist — tap to toggle**
  - Build the one/two-column checklist of active questions using their `shortLabel` (Task 3.1), each with a color swatch matching its line.
  - Tapping a row toggles that question's line visibility on the graph. Keep at least one line always visible (never allow toggling to zero).

- [ ] **Task 3.7: Legend — long-press to isolate/restore**
  - Holding a legend row (~400-500ms, shorter than the existing 1500ms hold-actions since this isn't a destructive action) isolates the graph to that question alone, hiding all others.
  - Holding the same row again while it's the sole active line restores all questions.

- [ ] **Task 3.8: Legend — accessible isolate alternative + quick actions**
  - Add a small per-row icon button that performs the same isolate/restore toggle as Task 3.7's long-press, reachable by click and by keyboard (Enter/Space on focus), since long-press alone is invisible to keyboard and screen-reader users.
  - Add "Show all" / "Clear all" utility buttons above the legend for a fast reset.

- [ ] **Task 3.9: Notes indicator on the graph timeline**
  - Show a small marker under any day that has a non-null `note` field on its log entry (notes are a single string per log, not tied to one question — do not try to plot them as a data series).
  - Tapping the marker reveals the note text.

---

### Phase 4: Offline Capabilities & PWA Readiness
- [ ] **Task 4.1: Service Worker Implementation**
  - Create a lightweight vanilla service worker (`sw.js`) to cache static assets (`index.html`, `style.css`, `app.js`, `manifest.json`).
  - Register the service worker inside `app.js` to enable 100% offline functionality.

- [ ] **Task 4.2: Web App Manifest Verification**
  - Verify and complete `manifest.json` with correct relative paths, high-resolution app icons, theme colors (`#121212`), and `display: "standalone"` parameters.

---

### Phase 5: Documentation & Final Cleanup
- [ ] **Task 5.1: Code Base JSDoc & Architectural Comments**
  - Perform a complete documentation pass on `app.js`, adding JSDoc comments to all core functions (`initDatabase`, `renderCurrentQuestion`, `exportAllDataAndConfig`, `handleFileImport`).

- [ ] **Task 5.2: Workspace File Cleanup**
  - Remove any unneeded project boilerplate files (such as `package.json` or `index.js` if created by IDE defaults) and verify the repository remains strictly clean vanilla files.