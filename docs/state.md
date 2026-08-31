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
| `seedVersion`       | `number`   | Integer (e.g. `3`)          | Tracks built-in default question seeding                 |

*Note: `handedness` and `holdDelay` preferences are also mirrored in `localStorage` for immediate pre-render access.*

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
      score: number | null; // 1-5 for scale answers; null if skipped
      status: 'answered' | 'skipped'; // Explicit status flag
    }>;
  }
  ```

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
  historyVisibleQuestionIds: null, // Set<string> | null (null = show all active)
  historyTimeRange: 'all' // '7d' | '14d' | '30d' | '90d' | 'all'
};
```

---

## 4. File & Module Layout

```
/
├── AGENTS.md                  # Development rules & documentation routing table
├── README.md                  # User-facing overview, motivation, donations & license
├── metadata.json              # Platform application metadata
├── package.json               # Test script & development tooling configuration
│
├── docs/
│   ├── state.md               # Current stack, schemas, config keys, and file layout (THIS FILE)
│   ├── decisions.md           # Append-only design rationale & locked decision history
│   ├── todo.md                # Task backlog & development roadmap (source of truth for progress)
│   └── dataset-guidelines.md  # Synthetic clinical dataset generation specification
│
├── public/                    # Deployable application files (served directly, no build step)
│   ├── index.html             # Single-page HTML canvas structure and modal dialogs
│   ├── style.css              # Consolidated stylesheet (tokens, themes, components, layouts)
│   ├── manifest.json          # PWA web application manifest
│   └── js/
│       ├── main.js            # Entry point: app initialization, event delegation, service worker
│       ├── state.js           # STATE singleton object definition
│       ├── utils.js           # Pure utility helpers (escapeHTML, safeRAF)
│       ├── questions.js       # Default question definitions, FNV-1a hashing, curve color helpers
│       ├── checkin.js         # Check-in card rendering, score submission, completion workflows
│       ├── data-io.js         # JSON export/import engines (Wipe & Replace, Smart Merge)
│       ├── storage/
│       │   ├── db.js          # IndexedDB wrapper (HighAndLowDB v3: config, questions, entries)
│       │   └── session.js     # sessionStorage active check-in persistence with 30-min TTL
│       └── ui/
│           ├── navigation.js  # View switching with 220ms orthogonal slide transitions
│           ├── settings-menu.js # Side drawer, theme, contrast, and handedness controllers
│           ├── dialogs.js     # Accessible modal notice, import, and note-taking dialogs
│           ├── history-graph.js # SVG mood timeline, continuous time scaling, filter legend
│           ├── hold-actions.js # 1.5s touch hold-to-confirm barrier engine
│           ├── keyboard-navigation.js # 1-5 keys, arrows, Enter/Space keyboard bindings
│           └── question-authoring.js  # Custom question authoring form and live card preview
│
└── tests/                     # Automated Vitest test suites
    ├── test-utils.js          # JSDOM, IndexedDB, and environment test harness
    ├── checkin_persistence.test.js
    ├── drawer.test.js
    ├── graph.test.js
    ├── handedness.test.js
    ├── hold_actions.test.js
    ├── questions.test.js
    ├── transitions.test.js
    └── synthetic-dataset.json
```
