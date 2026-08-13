# Design Decisions

Locked design decisions and open questions for High & Low (menu, questions store, curves).

## Locked decisions (as of 2026-07-14)

- **Navigation:** Retire the double-tap-header settings gesture. Originally a top-right hamburger menu, now enhanced to support user-configurable handedness (`right` default / `left`).
- **Two workflows:** low-energy (daily/semi-daily) = the tracker canvas is the home screen, just answer the active question set; high-energy (occasional) = everything behind the menu: question library, custom-question authoring, analytics/line graph, backup/restore, settings. The bridge is an **"active question set"** persisted to `config.activeQuestionSet`.
- **Questions store:** IndexedDB `questions` store (DB_VERSION 2). Keyed by an **immutable `id`**: built-ins get readable slugs (`q_energy`); custom questions get `c_` + FNV-1a-32 hex of normalized `originalText` (sync, dependency-free; content-addressing self-dedupes identical questions on merge). ID is FROZEN at creation — editing display `text` never changes the id, so edits don't orphan logs. **Never hard-delete a question — `archived: true` instead**, so historical logs always resolve. Fields: `id`, `originalText` (frozen), `text` (editable), `shortLabel`, `tags`, `curve`, `minLabel`, `maxLabel`, `midLabel`, `builtIn`, `archived`, `createdAt`, `updatedAt`.
  - **`originalText` is deliberately retained as the collision-audit / content-verification anchor** (decided 2026-07-16). Because the id is a lossy one-way FNV-1a-32 hash you cannot reconstruct the text from `c_<hash>`, so `originalText` is the only thing that keeps the id genuinely *content-addressed*: recompute `makeCustomId(originalText)` to confirm id integrity, and on a backup merge distinguish a legitimate display-`text` edit (same `originalText` → newest `updatedAt` wins) from a genuine 32-bit hash collision on two different questions (different `originalText` → must NOT be silently merged).
- **Curves:** `middle-is-best` curve is IN scope (deep blue → emerald → fire orange). Needs JS mapping, CSS (alongside `more-is-better` and `less-is-better`), and a `midLabel` shown on score 3.
- **No magic numbers for missing data (confirmed).** score stays 1–5 for real answers. Three states: answered = record with score 1–5 + `status:"answered"`; presented-but-skipped = record with `score:null` + `status:"skipped"`; not-asked/didn't-exist = NO record (absence). Never 0/-1 in the score field — it poisons the graph.
- **Notes are a `note` field on the log**, not a fake `custom_note` answer (retire the old `score:0` note hack).
- **Export dumps all three stores entire** (config + questions incl. archived + logs). Bump exportVersion→"2.0". Only merge conflict: same id, different text (an edit) → newest `updatedAt` wins.
- **`config` formalized:** `activeQuestionSet` (ordered id list), `theme`, `contrast`, `handedness`, `seedVersion` (drives adding new built-in defaults on app refresh without touching the user's set).

## Locked decisions (as of 2026-08-06)

- **Navigation:** Hamburger icon with user-configurable side (`right` default / `left`), opening a drawer that slides in from the configured side. Handedness preference is persisted in localStorage and config.

## Locked decisions (as of 2026-08-13)

- **No Question Rotation:** There is no automatic rotation. All questions enabled in `config.activeQuestionSet` appear directly in the tracker loop. Turning off a question removes it from the active tracker and places it strictly in the inactive question library.
- **Question Tags:** Questions support an array of string tags (`tags: string[]`). Tags are included in the custom question authoring/editing form and stored on the question record in IndexedDB.
- **Handedness & Non-Dominant Action Safety:** The layout setting is `handedness` (`right` vs `left`). Menu/drawer toggle sits on the dominant side, while potentially accidental actions like question `Edit` buttons sit on the **non-dominant side** to prevent accidental triggers during single-handed use.
- **Questions View Architecture:**
  - **Searchable List:** Live search filter at top filtering both text and tags.
  - **Active Tracker Questions Section (Top):** Cards for questions currently active in the mood tracker, with handles/ordering controls to adjust position in the tracking sequence, tags display, and an "In Tracker" toggle.
  - **Library Catalog Section (Bottom):** Cards for all inactive questions (built-in and custom), displaying full question text, tags, "Add to Tracker" toggle, and Edit action on the non-dominant side.
  - **Intuitive Card Ergonomics:** Clean card UI with question text prominently featured at top, tags/chips below, and actions strategically positioned for thumb reachability.


