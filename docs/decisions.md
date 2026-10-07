# Design Decisions

Standing constraints and the reasoning behind them. Read this before changing behavior in an area listed below; if a
change would violate an entry, stop and ask rather than working around it.

## What belongs here (admission test)

Add an entry only if **all** are true:

1. It constrains future work ("always/never X"), not just describes what was built.
2. The reason is not obvious from the code, tests, or `docs/state.md`.
3. Reversing it would plausibly cause data loss, break user trust, or hurt the target users.

Does **not** belong here: version bumps (`package.json` + git tags + `docs/versioning.md`), task history
(`docs/todo.md`, git log), schema/config field lists (`docs/state.md`), function/class/CSS names (the code and
JSDoc), naming and formatting rules (`AGENTS.md`). Superseded decisions are **edited or deleted, not appended to** —
this file describes the present, and git holds the past.

Entry format: **Rule.** Why. *(Enforced in: ...)* — omit the last part if nothing enforces it yet.

---

## Product principles

- **Two energy modes.** Low energy (daily): the tracker canvas is home and only asks the active question set. High
  energy (occasional): everything else lives behind the menu (question library, authoring, history, backup,
  settings). Do not add features to the tracker canvas that belong in the high-energy path. Why: users are often in
  severe fatigue; the daily path must stay minimal.
- **Dominant-side menu, non-dominant-side risky actions.** The menu toggle sits on the side of the user's
  `handedness`; actions that are dangerous if tapped by accident (Edit, destructive actions) sit on the opposite
  side. Why: prevents accidental triggers in one-handed use.
- **"Start Over" lives in the drawer, never on the tracker canvas.** Why: no clutter and no accidental taps in low
  states, but still a reachable route to a known-clean state.
- **Multiple check-ins per day are first-class.** Never assume one entry per day, never require a reload to log
  again. Finishing a check-in offers "Record Another Check-In", and re-entering the tracker after completion starts a
  fresh check-in. Why: users log at acute moments and at morning/evening.
- **In-progress check-ins survive reloads but not neglect.** Progress and current view persist in `sessionStorage`
  and expire after inactivity, so closing or abandoning the app reliably restarts at Question 1. Why: protects
  against accidental reloads and mobile memory reclamation without resuming a stale check-in.
- **User-facing terminology:** "Check-In" is the act; "Entry" is the stored record. Never use "Session", "Quiz",
  "Test", or "Log" in UI copy.

## Data model invariants

- **Missing data is never a magic number.** Scores are 1–5. Three states only: answered (score + `answered`),
  skipped (`score: null` + `skipped`), not asked (no record). Never write `0` or `-1`. Why: sentinels poison the
  graph and every aggregate.
- **Boolean questions persist as scores 1 (No) and 5 (Yes).** No separate answer shape. Why: graphing and
  aggregation stay uniform.
- **Question IDs are immutable; questions are never hard-deleted.** Editing `text` never changes `id`; removal sets
  `archived: true`. Why: historical entries must always resolve to a question.
- **`originalText` is frozen and retained.** Custom IDs are a lossy 32-bit hash of it, so it is the only way to
  verify an ID or to tell a legitimate `text` edit (same `originalText`) from a real hash collision (different
  `originalText`, which must **not** be silently merged). *(Enforced in: `tests/questions.test.js`)*
- **Notes are a field on the entry, not a fake answer.** The old `score: 0` note hack is retired.
- **No question rotation.** Every question in `config.activeQuestionSet` appears in every check-in, in that order.
  Deactivating a question moves it to the library; it does not delete it.
- **New built-in questions reach existing users via `seedVersion`, and never alter their active set.** Any change to
  built-in defaults requires a `SEED_VERSION` bump. Why: users' tracker configuration is theirs.
- **`middle-is-best` is a supported curve** (deep blue → emerald → fire orange, with `midLabel` on score 3).

## Backup & restore

- **Export dumps everything:** `config`, `questions` (including archived), and `entries`. Never a partial export.
- **Merge rules:** entries dedupe on exact timestamp; questions with the same id resolve to newest `updatedAt`,
  except the `originalText` collision rule above. Wipe & Replace and Smart Merge are separate, explicit modes.
- **Breaking any backup format is a MAJOR change** and needs a migration path (see `docs/versioning.md`).

## History graph

- **The X-axis is proportional to real elapsed time**, never entry count. Why: clustered and sparse check-ins must
  look clustered and sparse.
- **All entries are always in the domain.** Timeframe buttons are zoom presets, not data filters. Windows are reached
  by pan and zoom, not by excluding data.
- **The domain runs from the first to the last entry, with no baked-in padding.** All edge padding is CSS. Why:
  padding inside the SVG scales with zoom and produces dead space. (Repeatedly regressed; check the open bug in
  `docs/todo.md` before touching layout bounds.)
- **Zoom is unbounded** and pivots on the visible viewport center (buttons) or the gesture point (pinch/wheel).
- **Live gestures must not rebuild the DOM.** During a pinch or Ctrl/Meta+wheel, only CSS transforms are applied
  (with counter-scaling so points and text stay undistorted); a single real layout pass runs when the gesture ends.
  Why: 60 fps on low-end phones, and rebuilding mid-gesture drops the pointers.
- **Zero and single entries still render a working graph with controls,** not an empty-state message.

## Accessibility & interaction

- **Animations stay under 250 ms; controls stay large; no runtime dependencies.** (Also in `AGENTS.md`; repeated
  here because it is the most common thing to regress.)
- **The hold-to-confirm barrier applies only to actions that need it.** Do not wrap ordinary dialog buttons in it.
  *(Known bug tracked in `docs/todo.md`.)*
- **Import stays keyboard- and screen-reader-accessible:** a real `<button>` fronts the hidden file input, which is
  removed from the focus and accessibility trees.

## Localization

- **Translations are plain JSON only.** A language is `public/locales/<code>.json` plus one entry in
  `public/locales/manifest.json`; adding one must never require editing JavaScript. Do not add a second translation
  format (ES modules, generated templates). Why: translators are not necessarily programmers, and two formats drift
  apart. `en.json` is the template and the fallback for missing keys.
  *(Enforced in: `tests/localization.test.js` manifest check.)*

## Open Questions

*(None currently.)*