# High & Low — Current State & Architecture

Single source of truth for current runtime stack, data schemas, configuration keys, in-memory state, and file layout.

---

## 1. Tech Stack & Environment

| Layer                    | Specification                                                                                           |
|--------------------------|---------------------------------------------------------------------------------------------------------|
| **Architecture**         | Local-first, zero-dependency Progressive Web Application (PWA)                                          |
| **Frontend Core**        | Vanilla HTML5, Vanilla CSS3 (Custom Properties), Vanilla JavaScript (ES6+ Modules)                      |
| **Runtime Dependencies** | None (`0` external runtime libraries, frameworks, or build compilers)                                   |
| **Persistence**          | IndexedDB (`HighAndLowDB` v3) + `sessionStorage` (active session TTL) + `localStorage` (display caches) |
| **Test Environment**     | Node.js + Vitest + jsdom + fake-indexeddb (`npm test`)                                                  |

---

## 2. IndexedDB Schema (`HighAndLowDB` v3)

Database Name: `HighAndLowDB`  
Current Version: `3`

### Stores

#### `config` Store
* **KeyPath**: `'key'` (string)
* **Record Structure**: `{ key: string, value: any }`
* **Managed Keys**:

| Key                 | Type       | Allowed Values              | Description                                              |
|---------------------|------------|-----------------------------|----------------------------------------------------------|
| `activeQuestionSet` | `string[]` | Array of Question IDs       | Ordered list of question IDs appearing in active tracker |
| `theme`             | `string`   | `'system'\|'dark'\|'light'` | Color theme preference                                   |
| `contrast`          | `string`   | `'standard'` or `'high'`    | Contrast mode                                            |
| `handedness`        | `string`   | `'right'\|'left'`           | Menu and non-dominant action alignment                   |
| `holdDelay`         | `string`   | `'enabled'\|'disabled'`     | 1.5s hold-to-confirm barrier on touch actions            |
| `language`          | `string`   | `'en'` (expandable)         | Active user interface language preference                |
| `lastBackupAt`      | `string\|null` | ISO-8601 string or `null` | ISO-8601 timestamp of last successful backup export      |
| `seedVersion`       | `number`   | Integer (e.g. `4`)          | Tracks built-in default question seeding                 |

*Note: `handedness`, `holdDelay`, and `language` preferences are also mirrored in `localStorage` for pre-render access.*

#### `questions` Store
* **KeyPath**: `'id'` (string, immutable once created)
* **Record Structure**:
  ```typescript
  interface Question {
    id: string; // Built-in: 'q_<slug>' (e.g. 'q_energy'); Custom: 'c_<fnv1a32>'
    originalText: string; // Frozen at creation; collision audit anchor
    text: string; // Editable display text
    shortLabel: string; // 2-3 word label for charts, legend, and chips
    tags: string[]; // Category tags (e.g. ["Energy", "Somatic"])
    responseType: 'scale' | 'boolean'; // Type of answer format ('scale' = 1-5, 'boolean' = Yes/No)
    curve: 'more-is-better' | 'less-is-better' | 'middle-is-best';
    minLabel: string | null; // Label for score 1
    midLabel: string | null; // Label for score 3 (used by middle-is-best)
    maxLabel: string | null; // Label for score 5
    builtIn: boolean; // true for defaults, false for user-authored
    archived: boolean; // Soft-delete flag; true hides from library catalog
    createdAt: string; // ISO-8601 timestamp
    updatedAt: string; // ISO-8601 timestamp
  }
  ```
* **Localization Invariant**: Questions in IndexedDB and backups maintain their stored `text`, `shortLabel`, and
  endpoint labels. At render time, unedited built-in questions (`builtIn: true` where `text === originalText`) resolve
  their displayed copy dynamically from the active locale dictionary (`public/locales/<lang>.json`) by question `id`.
  Custom and user-edited questions (`builtIn: false` or `text !== originalText`) always display user-provided text
  untranslated. No `seedVersion` bump is required.

#### `entries` Store
* **KeyPath**: `'timestamp'` (string, ISO-8601 UTC)
* **Record Structure**:
  ```typescript
  interface Entry {
    timestamp: string; // e.g. "2026-08-31T12:00:00.000Z" (Unique PK)
    dateString: string; // e.g. "2026-08-31" (Local date representation)
    note: string | null; // Optional free-text check-in note
    answers: Array<{
      questionId: string;
      score: number | null; // 1-5 for scale; BOOLEAN_NO_SCORE (1) or BOOLEAN_YES_SCORE (5) for boolean; null if skipped
      status: 'answered' | 'skipped'; // Explicit status flag
    }>;
  }
  ```

* **Boolean Score Mapping (`public/js/questions.js`)**:
  * `BOOLEAN_NO_SCORE = 1`: Mapped score persisted for "No" answers on boolean questions.
  * `BOOLEAN_YES_SCORE = 5`: Mapped score persisted for "Yes" answers on boolean questions.
  * Allows graph pipelines, grid lines, and score aggregations to handle boolean questions without schema divergence.

### Backup File Format & Scopes (`public/js/data-io.js`)

#### JSON File Structure
```json
{
  "exportVersion": "2.0",
  "exportTimestamp": "2026-10-15T13:30:00.000Z",
  "scope": ["history", "settings"],
  "config": [],
  "questions": [],
  "entries": []
}
```

#### Export Scopes
* **`history`**:
  * Exports all check-in records from the `entries` store.
  * Exports every question record (active and archived) referenced by any entry in `entries`. Question records must be
    present so entries never have orphaned questions when imported to a fresh device.
  * Updates `lastBackupAt` in `config` upon completion.
* **`settings`**:
  * Exports all questions in the question catalog (active, catalog, and archived).
  * Exports allowlisted configuration keys: `activeQuestionSet`, `theme`, `contrast`, `handedness`, `holdDelay`, and
    `language`.
  * Excludes device-specific keys: `seedVersion` and `lastBackupAt` are never exported.
  * Does NOT update `lastBackupAt`.

#### Filename Convention
* Full backup (`history` + `settings`): `high-and-low-backup-<YYYY-MM-DD>-full.json`
* History only: `high-and-low-backup-<YYYY-MM-DD>-history-only.json`
* Settings only: `high-and-low-backup-<YYYY-MM-DD>-settings-only.json`

#### Partial Backup Import & Scoped Restore (`public/js/data-io.js`, Task 2.19)
* **Validation**:
  * Accepts valid JSON with recognized `exportVersion` (`1.0` or `2.0`).
  * Requires at least one of `entries`, `questions`, or `config` to be present as an array.
  * Empty store arrays (e.g., `entries: []`) are valid.
  * Rejects missing/unrecognized `exportVersion` or files lacking all store arrays.
* **Scope Scoping (Wipe & Replace)**:
  * Only wipes the IndexedDB stores whose data the backup actually contains:
    * History scope: clears `entries` store; merges referenced questions into `questions` store (orphan prevention).
    * Settings scope: clears `config` and `questions` stores, retaining local `seedVersion`.
    * Settings-only replace never wipes or alters check-in history in `entries`.
    * History-only replace never resets settings or questions in `config` or `questions`.
* **Smart Merge**:
  * Non-destructive merge across all present stores (dedupes entries on timestamp, resolves questions by `updatedAt`).
* **Device Keys Ignored**:
  * Incoming `seedVersion` and `lastBackupAt` keys are ignored and never overwrite device values.

#### Erase All Data Operation (`public/js/data-io.js`, Task 2.20)
* **Location & Interaction**:
  * Located in its own clearly separated danger section at the bottom of the Data view (`#section-erase-data`).
  * Initiated via `#button-erase-data`, protected by a 1.5-second hold barrier enforced even when `holdDelay` is disabled.
* **Confirmation Modal (`#erase-dialog-overlay`)**:
  * Plainly lists all categories of data that will be permanently removed.
  * Offers "Back Up First" (`#button-erase-backup`) as the primary, default-focused option to trigger a full backup export.
  * Standard dialog buttons for "Cancel" and "Erase Everything" without hold delay.
* **Atomic Erasure & First-Run Reset**:
  * Performs IndexedDB `clear()` on `entries`, `questions`, and `config` stores in a single atomic readwrite transaction.
  * If the transaction aborts or errors, all stores and storage caches remain intact and an error notice is shown.
  * On transaction completion, clears `sessionStorage` (`high_and_low_active_checkin`, `high_and_low_active_view`)
    and `localStorage` display caches (`handedness`, `holdDelay`, `menuSide`, `debug-bounds`).
  * Re-seeds built-in questions and default active set via `seedDefaults()`, resets in-memory `STATE`, and reloads into
    a clean first-run state.
  * Does not touch service worker registration or runtime asset caches.

---

## 3. Session & In-Memory State

### Active Check-in Session (`sessionStorage`)
* **Keys**:
  * `high_and_low_active_checkin`: `{ currentQuestionIndex: number, checkinAnswers: Array<Answer>, checkinNote: string | null, updatedAt: number }`
  * `high_and_low_active_view`: `{ viewId: string, updatedAt: number }`
* **TTL**: 30 minutes of inactivity (`SESSION_EXPIRY_MS = 1800000`). Stale sessions are purged on initialization.

### Global In-Memory Singleton (`STATE` in `public/js/state.js`)
```javascript
export const STATE = {
  activeQuestions: [], // Loaded Question objects in active sequence
  currentQuestionIndex: 0, // Current active question pointer (0-indexed)
  checkinAnswers: [], // In-flight answers for current check-in
  checkinNote: null, // In-flight note text
  deviceMode: 'mouse', // 'mouse' | 'touch'
  language: 'en', // Active language code, as listed in locales/manifest.json
  historyVisibleQuestionIds: null, // Set<string> | null (null = show all active)
  historyTimeRange: 'all', // '7d' | '14d' | '30d' | '90d' | 'all'
  historyZoomScale: 1, // Timeline zoom scale (unbounded continuous scale, default 1.0)
  historyScrollLeft: 0 // Timeline scroll anchor retained during zoom
};
```

---

## 4. File & Module Layout

```
/
├── AGENTS.md                  # Development rules & documentation routing table
├── README.md                  # User-facing overview, motivation, donations & license
├── package.json               # Test script & development tooling configuration
├── server.js                  # Zero-dependency local development static server (Port 3000)
│
├── docs/
│   ├── state.md               # Current stack, schemas, config keys, and file layout (THIS FILE)
│   ├── decisions.md           # Append-only design rationale & locked decision history
│   ├── todo.md                # Task backlog & development roadmap (source of truth for progress)
│   ├── dataset-guidelines.md  # Synthetic clinical dataset generation specification
│   └── versioning.md          # Semantic versioning policy, pre-1.0 rules & bump matrix
│
├── public/                    # Deployable application files (served directly, no build step)
│   ├── index.html             # Single-page HTML canvas structure and modal dialogs
│   ├── style.css              # Consolidated stylesheet (tokens, themes, components, layouts)
│   ├── manifest.json          # PWA web application manifest
│   ├── sw.js                  # Offline service worker (precache & network-first strategy, CACHE_NAME v10)
│   ├── icons/                 # PWA and browser icon assets
│   │   ├── favicon.ico        # Desktop favicon
│   │   ├── favicon.png        # PNG favicon
│   │   ├── apple-touch-icon.png # iOS home screen icon
│   │   ├── pwa-192x192.png    # Standard PWA application icon (192x192)
│   │   ├── pwa-512x512.png    # High-res PWA application icon (512x512)
│   │   └── pwa-maskable-512x512.png # Maskable adaptive icon (512x512)
│   ├── locales/               # Drop-in localization directory (JSON only)
│   │   ├── manifest.json      # Lists available languages (code, name, direction); read at startup and by sw.js
│   │   ├── en.json            # English translation dictionary (default language, template, and fallback)
│   │   └── README.md          # Contribution instructions & terminology rules
│   └── js/
│       ├── main.js            # Entry point: app bootstrap, event delegation, SW lifecycle
│       ├── service-worker.js  # Legacy service worker forwarder (delegates to ../sw.js)
│       ├── state.js           # STATE singleton object definition
│       ├── utils.js           # Pure utility helpers (escapeHTML, html tagged template, safeRAF)
│       ├── localization.js    # Translation engine, JSON locale loader, DOM translations & state
│       ├── questions.js       # Default question definitions, FNV-1a hashing, curve color helpers
│       ├── checkin.js         # Check-in card rendering, score submission, completion workflows
│       ├── data-io.js         # JSON export/import engines (Wipe & Replace, Smart Merge)
│       ├── storage/
│       │   ├── db.js          # IndexedDB wrapper (HighAndLowDB v3: config, questions, entries)
│       │   └── session.js     # sessionStorage active check-in persistence with 30-min TTL
│       └── ui/
│           ├── navigation.js  # View switching with 220ms orthogonal slide transitions
│           ├── settings-menu.js # Side drawer, theme, contrast, handedness, and language controllers
│           ├── dialogs.js     # Accessible modal notice, selective export, import, and note dialogs
│           ├── history-graph.js # SVG mood timeline, gesture zoom, live CSS transform & counter-scaling, legend
│           ├── hold-actions.js # 1.5s touch hold-to-confirm barrier engine
│           ├── keyboard-navigation.js # 1-5 keys, arrows, Enter/Space keyboard bindings
│           └── question-view.js  # Questions catalog view, search, cards, and custom question modal
│
└── tests/                     # Automated Vitest test suites
    ├── test-utils.js          # JSDOM, IndexedDB, and environment test harness
    ├── about_view.test.js
    ├── active_tracker_cards.test.js
    ├── catalog_cards.test.js
    ├── checkin_persistence.test.js
    ├── data_backup.test.js
    ├── drawer.test.js
    ├── erase_data.test.js
    ├── export_dialog.test.js
    ├── graph.test.js
    ├── graph_gestures.test.js
    ├── handedness.test.js
    ├── hold_actions.test.js
    ├── localization.test.js
    ├── partial_import.test.js
    ├── question_copying.test.js
    ├── question_editing.test.js
    ├── question_response_type.test.js
    ├── questions.test.js
    ├── questions-view.test.js
    ├── removed_questions.test.js
    ├── selective_backup.test.js
    ├── service_worker.test.js
    ├── transitions.test.js
    └── synthetic-dataset.json
```