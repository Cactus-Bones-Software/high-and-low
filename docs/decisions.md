# Design Decisions

Locked design decisions and open questions for High & Low (menu, question store, curves).

## As of 2026-07-14

- **Navigation:** Retire the double-tap-header settings gesture. Originally a top-right hamburger menu, now enhanced
  to support user-configurable handedness (`right` default / `left`).
- **Two workflows:** low energy (daily/semi-daily) = the tracker canvas is the home screen, only answer the active
  question set; high energy (occasional) = everything behind the menu: question library, custom-question authoring,
  analytics/line graph, backup/restore, settings. The bridge is an **"active question set"** persisted to
  `config.activeQuestionSet`.
- **Questions store:** IndexedDB `questions` store (DB_VERSION 2). Keyed by an **immutable `id`**: built-ins get
  readable slugs (`q_energy`); custom questions get `c_` + FNV-1a-32 hex of normalized `originalText` (sync,
  dependency-free; content-addressing self-dedupes identical questions on merge). ID is FROZEN at creation — editing
  display `text` never changes the id, so edits don't orphan entries. **Never hard-delete a question —
  `archived: true` instead**, so historical entries always resolve. Fields: `id`, `originalText` (frozen),
  `text` (editable), `shortLabel`, `tags`, `curve`, `minLabel`, `maxLabel`, `midLabel`, `builtIn`, `archived`,
  `createdAt`, `updatedAt`.
  - **`originalText` is deliberately retained as the collision-audit / content-verification anchor** (decided
    2026-07-16). Because the id is a lossy one-way FNV-1a-32 hash you cannot reconstruct the text from `c_<hash>`,
    so `originalText` is the only thing that keeps the id genuinely *content-addressed*: recompute
    `makeCustomId(originalText)` to confirm id integrity, and on a backup merge distinguish a legitimate
    display-`text` edit (same `originalText` → newest `updatedAt` wins) from a genuine 32-bit hash collision on two
    different questions (different `originalText` → must NOT be silently merged).
- **Curves:** `middle-is-best` curve is IN scope (deep blue → emerald → fire orange). Needs JS mapping, CSS (alongside
  `more-is-better` and `less-is-better`), and a `midLabel` shown on score 3.
- **No magic numbers for missing data (confirmed).** The score stays 1–5 for real answers. Three states: answered =
  record with score 1–5 + `status:"answered"`; presented-but-skipped = record with `score:null` +
  `status:"skipped"`; not-asked/didn't-exist = NO record (absence). Never `0` or `-1` in the score field — it
  poisons the graph.
- **Notes are a `note` field on the entry**, not a fake `custom_note` answer (retire the old `score:0` note hack).
- **Export dumps all three stores entirely** (`config` + `questions` (includes archive) and `entries`). Bump
  exportVersion→"2.0". Only merge conflict: same id, different text (an edit) → newest `updatedAt` wins.
- **`config` formalized:** `activeQuestionSet` (ordered id list), `theme`, `contrast`, `menuSide`, `seedVersion`
  (drives adding new built-in defaults on app refresh without touching the user's set).

## As of 2026-08-06

- **Navigation:** Hamburger icon with user-configurable side (`right` default / `left`), opening a drawer that
  slides in from the configured side. Handedness preference is persisted in localStorage and config.

## As of 2026-08-13

- **No Question Rotation:** There is no automatic rotation. All questions enabled in `config.activeQuestionSet`
  appear directly in the tracker loop. Turning off a question removes it from the active tracker and places it
  strictly in the inactive question library.
- **Question Tags:** Questions support an array of string tags (`tags: string[]`). Tags are included in the custom
  question authoring/editing form and stored on the question record in IndexedDB.
- **Handedness & Non-Dominant Action Safety:** The layout setting is `handedness` (`right` vs `left`). Menu/drawer
  toggle sits on the dominant side, while potentially accidental actions like question `Edit` buttons sit on the
  **non-dominant side** to prevent accidental triggers during single-handed use.
- **Questions View Architecture:**
  - **Searchable List:** Live search filter at the top, filtering both text and tags.
  - **Active Tracker Questions Section (Top):** Cards for questions currently active in the mood tracker, with
    handles/ordering controls to adjust position in the tracking sequence, a tag display, and an "In Tracker" toggle.
  - **Library Catalog Section (Bottom):** Cards for all inactive questions (built-in and custom), displaying full
    question text, tags, "Add to Tracker" toggle, and Edit action on the non-dominant side.
  - **Intuitive Card Ergonomics:** Clean card UI with question text prominently featured at the top, tags/chips
    below, and actions strategically positioned for thumb reachability.
- **Yes/No Question Support:** Questions support binary Yes/No responses in addition to the standard 1–5 scale.
  Yes/No questions render as a streamlined 2-button choice deck in the tracker and plot cleanly on the analytics
  timeline.

## As of 2026-08-14

- **Intra-Day & Multi-Entry Check-Ins:** Patients often need to record mood check-ins multiple times per day (e.g.,
  morning/evening or during acute symptom spikes). The application fully supports multiple entries per day:
  - **Time-Scaled History Graph:** The history timeline X-axis is chronologically continuous, scaling proportional to
    the real elapsed time between records (`(t - t_min) / (t_max - t_min)`). Spaced check-ins reflect real elapsed
    time rather than arbitrary discrete indices. Ticks and tooltips adaptively surface hours/minutes when entries
    share the same day or when viewing short-range histories.
  - **Zero-Reload Continuous Check-In Workflow:** The completion screen surfaces a primary "Record Another Check-In"
    action, and navigating to the Mood Tracker from the drawer or secondary views automatically starts a fresh
    check-in if the previous check-in was completed. Users never need to reload the page or restart the PWA to log
    again.

## As of 2026-08-18

- **Check-In Persistence & Stale Expiry:**
  - Active check-in progress (current question index, check-in answers, attached check-in note) and current view
    state are persisted in `sessionStorage` with a 30-minute inactivity TTL timeout.
  - This protects in-progress check-ins from accidental page reloads, theme switches, and mobile memory reclamation
    while ensuring that quitting/closing the app or leaving a check-in idle for >30 minutes reliably starts clean on
    Question 1 of the Tracker canvas.
- **Drawer "Start Over / Restart Check-In" Placement:**
  - The "Start Over" action will be housed inside the navigation side drawer rather than on the main tracker canvas.
  - This avoids visual clutter on the tracker screen and prevents accidental taps during low-energy states, while
    maintaining a clear, accessible route back to a known initial state.
- **No Truncated Abbreviations in Code (Explicit Naming Standards):**
  - Use clear, unabbreviated, descriptive variable and parameter names across the codebase.
  - Avoid truncated abbreviations such as `btn` for `button`, `el` for `element`, `cb` for `callback`, `opts` for
    `options`, `idx` for `index`, `msg` for `message`, `curr`/`prev` for `current`/`previous`, `evt`/`e` for `event`,
    `doc`/`win` for `document`/`window`, etc.
  - Always write full words (e.g. `menuButton`, `targetElement`, `progressElement`, `callback`, `options`, `event`)
    for maximum clarity, readability, and intent preservation.
- **Unified Terminology: Check-In vs Entry**
  - **Primary user-facing noun:** "Check-In" for the interaction/moment, and "Entry" (plural: "Entries") for the
    stored historical record.
  - **UI Copy Consistency:** Standardize completion and prompt messages around Check-In (e.g. "Check-In recorded",
    "New Check-In"). Retire ambiguous aliases like "Session", "Quiz", "Test", and "Log" in user-facing text.

- **Unified Question Card Architecture & Reorder Visibility:**
  - Both active tracker cards and catalog cards share a single, unified HTML template structure
    (`buildQuestionCardHTML`).
  - The activation toggle switch is placed in the header status group (`.question-card-status-group`) directly below
    the Built-In / Custom badge on all cards.
  - The Edit button (`.question-edit-button`) is always visible in the non-dominant action slot
    (`.card-actions-non-dominant`) across all question cards.
  - Reordering controls (up/down buttons and the center drag handle) are grouped in the center container
    (`.card-actions-center`) with the Up button on the left and Down button on the right flanking the drag handle.
    Their visibility is styled and toggled via the `.is-reorderable` class, ensuring cards can be dynamically rendered
    with or without reordering affordances while sharing the exact same DOM and style rules.

## As of 2026-09-14

- **Versioning:**
  - Decided to implement Semantic Versioning.
  - Reduced version to 0.1.0.
- **Version Bump 0.2.0 (Task 5.10.1):**
  - Bumped version to `0.2.0` (MINOR) per `docs/versioning.md` for additive schema enhancement.
  - Added `responseType: 'scale' | 'boolean'` to question records in `HighAndLowDB` (`questions` store), with automatic
    backfill to `'scale'` for existing records in `seedDefaults`.
- **Built-In Binary Question (q_eaten):**
  - Added "Have you eaten today?" (`q_eaten`) with `responseType: 'boolean'` to `DEFAULT_QUESTIONS`.
  - Bumped `SEED_VERSION` to `4` so existing client databases automatically ingest the new built-in question into the
    catalog on next load without disturbing the user's active set.
  - Retained version `0.2.0` in working copy per user directive.

## As of 2026-09-16

- **Version Bump 0.2.1 (Task 9.1):**
  - Bumped version to `0.2.1` (PATCH) per `docs/versioning.md` for internal graph timeline coordinate refactor.
  - Replaced entry-count-driven width calculations in `computeGraphLayout()` with an exported base-scale constant
    (`BASE_PIXELS_PER_HOUR = 2`), deriving point and note horizontal positions directly from elapsed time
    `paddingLeft + (entryTime - originTime) * timeScale`.
- **Retire Timeframe Entry Filtering (Task 9.2):**
  - Removed timeframe cutoff filtering (`7d`/`14d`/`30d`/`90d`/`all` entry slicing) from `computeGraphLayout()`.
  - Full entry history is always included in the rendered and scrollable SVG domain; navigation and viewing windows
    are handled via panning and zoom scale presets (Task 9.3) rather than DOM data exclusion.
  - No version bump required (internal graph layout behavior refactor, retaining version `0.2.1`).
- **Version Bump 0.2.2: Repurpose Timeframe Buttons as Zoom Presets (Task 9.3):**
  - Bumped version to `0.2.2` (PATCH) per `docs/versioning.md` for UI and accessibility updates to zoom shortcuts.
  - Repurposed the timeframe toolbar buttons (`~7D`, `~14D`, `~30D`, `~90D`, `All`) as scale shortcuts rather than data
    filters. Clicking a preset calculates the zoom scale multiplier needed to span the target duration across the
    active viewport width: `calculateTimeframePresetZoomScale(rangeKey, { entries, viewportWidth })`.
  - Zoom adjustments dynamically preserve user context by pivoting around the horizontal center of the visible
    viewport: `calculateZoomPivotScrollLeft({ previousScrollLeft, viewportWidth, previousZoomScale, nextZoomScale, paddingLeft })`.
  - Updated button accessible names (`Zoom to ~7 days`, `Zoom to all entries`) and toolbar role descriptions to
    accurately convey zoom scale behavior.

- **Version Bump 0.2.3: Zoom Buttons — Pivot on Viewport Center, No Clamp (Task 9.4):**
  - Bumped version to `0.2.3` (PATCH) per `docs/versioning.md` for UI and zoom button behavior updates.
  - Updated `+`/`−` zoom button handlers to scale the time-to-pixel rate around the horizontal center of the
    currently visible viewport using `calculateZoomPivotScrollLeft`, seamlessly retaining the user's visual center.
  - Removed the previous `0.5`–`3.0` zoom scale clamp (`isZoomOutDisabled`/`isZoomInDisabled`), allowing unbounded
    continuous zoom in both directions.
  - Hardened horizontal scroll position restoration across re-renders to preserve scroll anchors when container layout
    dimensions are pending or unmeasured.

- **Version Bump 0.3.0: `NOW` Return Button (Task 9.5):**
  - Bumped version to `0.3.0` (MINOR) per `docs/versioning.md` for adding a new interactive control to the timeline
    header.
  - Added a `NOW` return button (`#button-graph-now`, `.graph-now-button`) to `.graph-header-controls` that pans
    the horizontal scroll position to the rightmost edge (`calculateNowScrollLeft`) so the most recent entry sits
    at its normal position with trailing padding from any current pan/zoom state.
  - Preserves the current zoom scale (`STATE.historyZoomScale`) without alteration during panning.
  - Wired live `scroll` event listener on `.graph-scroll-container` to continuously keep `STATE.historyScrollLeft`
    synchronized with user panning and smooth scrolling.

## As of 2026-09-16

- **Version Bump 0.3.1: Fixed Leading/Trailing Time Padding (Task 9.6):**
  - Bumped version to `0.3.1` (PATCH) per `docs/versioning.md` for graph layout timeline padding refactor.
  - Reserved a static timeline padding equal to 7 real days at the active zoom scale before the first entry and after
    the later of (last entry, "now") at all times, providing a clear visual edge buffer without abrupt boundary stops.
  - Defined the zero-entry and single-entry states to render a 7-day-wide padding window ending at "now" with full
    SVG axis gridlines and timeline controls rather than rendering an empty/no-graph message state.

- **Version Bump 0.3.2: Accessible Backup File Import Activation & Drop Zone:**
  - Bumped version to `0.3.2` (PATCH) per `docs/versioning.md` for fixing file import activation.
  - Fixed `#button-import` click handler to forward activation to the hidden `#file-import` input while clearing its
    previous value so repeat imports of the same file trigger change events reliably.
  - Excluded the hidden `#file-import` input from accessibility/focus trees (`tabindex="-1"`, `aria-hidden="true"`)
    ensuring screen readers focus cleanly on the semantic `<button id="button-import">` without Biome a11y violations.
  - Added drag-and-drop file support to `.file-import-zone` with visual feedback (`.drag-over`) allowing direct file
    drops into the import workflow.

## As of 2026-09-17

- **Version Bump 0.3.3: Graph Viewport Padding & Ending on Most Recent Record:**
  - Bumped version to `0.3.3` (PATCH) per `docs/versioning.md` for graph timeline domain and layout padding refactor.
  - Replaced the hardcoded 7-day JavaScript timeline padding with CSS-based viewport padding (10% on left and right of
    `.graph-scroll-content`, paired with `scroll-padding-inline: 10%` on `.graph-scroll-container`).
  - Updated graph timeline bounds in `computeGraphLayout` so multiple entries start on the earliest record and end
    on the most recent record (not on the current date/now).
  - Single entries end on that record with a 24-hour baseline window; zero-entry case renders a 24-hour baseline window
    ending at now.

- **Version Bump 0.3.4: Elimination of Baked-in SVG Deadspace:**
  - Bumped version to `0.3.4` (PATCH) per `docs/versioning.md` for removing residual timeline deadspace from the SVG.
  - Eliminated the 24-hour artificial baseline window previously added to single-entry and zero-entry cases,
    anchoring domain duration directly to `0` with `leadingPaddingMs: 0` and `trailingPaddingMs: 0`.
  - Prevents the SVG width from scaling empty deadspace when zooming in, ensuring all horizontal padding and margins
    are driven strictly by CSS (`padding-left: 10%` and `padding-right: 10%`).

## Open Questions
