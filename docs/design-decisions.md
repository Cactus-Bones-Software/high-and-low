# Design Decisions

Locked design decisions and open questions for High & Low (menu, questions store, curves).

## Locked decisions (as of 2026-07-14)

- **Navigation:** Retire the double-tap-header settings gesture (it was testing scaffolding). Replace with a **hamburger icon top-right** opening a **drawer that slides in from the right** (reuse the orthogonal-slide system).
- **Two workflows:** low-energy (daily/semi-daily) = the tracker canvas is the home screen, just answer the active question set; high-energy (occasional) = everything behind the menu: question library, custom-question authoring, analytics/line graph, backup/restore, theming. The bridge is an **"active question set"** persisted to `config` (today it's hard-coded in app.js: `[0],[1],[3]`).
- **Questions store:** new `questions` IndexedDB object store (bump DB_VERSION 1→2). Keyed by an **immutable `id`**: built-ins get readable slugs (`q_energy`); custom questions get `c_` + FNV-1a-32 hex of normalized `originalText` (sync, dependency-free; content-addressing self-dedupes identical questions on merge). Id is FROZEN at creation — editing display `text` never changes the id, so edits don't orphan logs. **Never hard-delete a question — `archived: true` instead**, so historical logs always resolve. Fields: id, originalText (frozen), text (editable), curve, minLabel, maxLabel, midLabel, builtIn, archived, createdAt, updatedAt.
- **Curves:** `middle-is-best` curve is IN scope (deep blue → emerald → fire orange). Needs JS mapping, CSS (only `more-is-better`/`less-is-better` exist), and a `midLabel` shown on score 3.
- **No magic numbers for missing data (confirmed).** score stays 1–5 for real answers. Three states: answered = record with score 1–5 + `status:"answered"`; presented-but-skipped = record with `score:null` + `status:"skipped"`; not-asked/didn't-exist = NO record (absence). Never 0/-1 in the score field — it poisons the graph.
- **Notes are a `note` field on the log**, not a fake `custom_note` answer (retire the old `score:0` note hack).
- **Export dumps all three stores entire** (config + questions incl. archived + logs). Bump exportVersion→"2.0". Only merge conflict: same id, different text (an edit) → newest `updatedAt` wins.
- **`config` formalized:** `activeQuestionSet` (ordered id list, replaces hard-coded `[0],[1],[3]` at app.js:260), `theme`, `contrast`, `seedVersion` (drives adding new built-in defaults on app refresh without touching the user's set).

## Implemented (2026-07-14)

The full data model above is now in code (app.js DB_VERSION 2, questions store + seedDefaults + fnv1a32/makeCustomId, config-driven activeQuestionSet, persisted theme/contrast, skip-backfill in finalizeSession, note field, export v2.0 + questions import w/ updatedAt merge), the `middle-is-best` curve (JS midLabel on score 3 + CSS palettes in all 4 theme blocks; a built-in `q_overall` question exercises it), and the top-right hamburger + right-sliding settings drawer (double-tap gesture removed). Decided: skip-backfill YES; notes = single string for MVP (multi-note array is a tabled future feature, noted in executeHoldAction); v1→v2 = user wipes dev DB, no migration code.

**Verified** in headless Firefox via its built-in Marionette protocol (no geckodriver/Playwright/Selenium available — hand-rolled a dependency-free Node TCP client; scripts at /tmp/hl_marionette.js + /tmp/hl_shot.js). Firefox allows IndexedDB on file:// (Chrome does not), so the app loads straight from disk. Confirmed: seeding (7 built-ins, default set of 4), middle-is-best curve renders (blue→emerald→orange + midLabel on 3), custom-id normalization + c_ prefix, skip-backfill (skipped records have score:null), config theme persistence, hamburger + right drawer, drawer hides hamburger. Reusable technique for future browser verification of this app.

## Still parked / next up

- Custom-question authoring UI (writing your own questions → questions store via makeCustomId). Store + id gen exist; UI does not.
- Active-set editor UI (pick/reorder/archive questions from the library). Backed by config.activeQuestionSet.
- Analytics / line graph (reads logs; skipped=null and absent both = gaps).
- Notes-as-array (`notes:[]`) — tabled possible feature.
- manifest.json + service worker — parked until MVP. README parked until MVP.
- Whether color-coding answer options is harmful — pending accessibility-expert / psychiatrist review.
- `manifest.json` intentionally NOT created yet (referenced in index.html but absent). Wait until MVP. README also parked until MVP.
