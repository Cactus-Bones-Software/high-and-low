# Project Scope — High & Low

Source: README.md, AGENTS.md, package.json, docs/project-context.md, docs/design-decisions.md, docs/todo.md. Those files are canonical; this is a snapshot.

## What
Local-first, zero-friction mood tracker for bipolar/unipolar cycles, optimized for low-energy states. PWA. 1–5 scales + Yes/No, one question at a time.

## Non-Goals
- No medical advice (records only, no diagnosis/guidance)
- No external dependencies (no npm, no frameworks, no build step)
- No cloud, ever
- Not for sale

## Stack
- Vanilla HTML5/CSS3/JS (ES6+), zero runtime deps
- PWA: manifest.json + service worker
- IndexedDB `HighAndLowDB` v2: `config`, `questions`, `logs` stores
- Dev-only: Vitest, jsdom, fake-indexeddb

## Architecture Rules
- Low cognitive load: 220ms transitions, "Skip the Rest," full-width touch targets
- JSON export/import: destructive replace + non-destructive timestamp merge
- Accessibility: theme (dark/light/system), contrast (standard/high), handedness (right/left)
- Nav/tools behind drawer, not on tracker canvas

## Data Schema

**questions** (immutable `id`):
- Built-in: slug (`q_energy`). Custom: `c_` + FNV-1a-32 hash of `originalText`.
- `id` frozen at creation; edits to `text` don't orphan logs.
- Never hard-deleted — `archived: true`.
- `originalText` kept as collision-audit anchor (hash is one-way).
- Fields: `id`, `originalText`, `text`, `shortLabel`, `tags[]`, `curve` (more/less/middle-is-best), `responseType` (scale/boolean), `minLabel`, `midLabel`, `maxLabel`, `builtIn`, `archived`, `createdAt`, `updatedAt`.

**logs** (key: ISO timestamp):
- `{ timestamp, note?, answers: [{questionId, score: 1-5|null, status: 'answered'|'skipped'}] }`
- 3 states only: answered (score+status), skipped (null+status), not-asked (no record). Never 0/-1.
- Notes: `note` field on log, not a fake answer.

**config**: `activeQuestionSet`, `theme`, `contrast`, `handedness`, `seedVersion`.

**Export**: full dump of all 3 stores, `exportVersion: "2.0"`. Merge rule: same id + different text → newest `updatedAt` wins. Different `originalText`, same hash → never auto-merge.

## Locked Interaction Decisions
- Two workflows: low-energy = tracker is home; high-energy = drawer (library, authoring, analytics, backup, settings). Bridge: `activeQuestionSet`.
- No question rotation — full active set every check-in.
- Handedness: drawer toggle dominant side; risky actions (Edit) non-dominant side.
- Hold-to-confirm: 1.5s destructive, ~400-500ms legend isolate/restore.
- Multi-log/day supported; graph X-axis time-proportional, not index-based.
- Zero-reload continuous check-in via "Record Another Check-In."
- Session state in `sessionStorage`, 30-min TTL.
- "Start Over" lives in drawer, not tracker canvas.
- Terminology: "Check-In" (action), "Entry/Entries" (stored record). No "Session/Quiz/Test/Log."
- No abbreviated names in code (`button` not `btn`, etc.)

## Questions View (Phase 4 target)
- Live search (text + tags)
- Active Tracker section (top): reorderable, "In Tracker" toggle
- Library Catalog (bottom): "Add to Tracker" toggle, Edit on non-dominant side
- Yes/No renders as 2-button deck, plots alongside scale questions

## Build Status
- **Ph1 Storage**: done
- **Ph2 UI/A11y**: done
- **Ph3 Analytics**: mostly done. Open: 3.8 accessible isolate/keyboard, 3.9 notes indicator, 3.10 drawer restart
- **Ph4 Question Library**: not started (tags, handedness alignment, search UI, card sections, edit/archive, Yes/No schema+UI)
- **Ph5 PWA/Offline**: not started (service worker, manifest verification)
- **Ph6 Docs/Cleanup**: partial. Done: test harness. Open: JSDoc, workspace cleanup, i18n

## Repo Structure
`public/` (app source) · `docs/` (context, decisions, todo) · `tests/` (Vitest) · `.github/workflows/` (CI) · README.md, AGENTS.md, LICENSE (AGPL-3.0), package.json

## Governance
AGPL-3.0. Single maintainer, no succession structure. Funding/handoff messaging: see `talking-points.md`.