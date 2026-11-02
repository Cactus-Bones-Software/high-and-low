# Agent Instructions & Project Conventions

## Core Philosophy & Directives
- **Project Identity**: You are working on "High & Low", a local-first, low-friction mood tracking web application
  built strictly with vanilla HTML, CSS, and JavaScript (no frameworks, compilers, or external runtime dependencies).
- **Single Task Focus**: Execute **ONE single unchecked task (`[ ]`) at a time** from `docs/todo.md`. Do NOT move to
  the next task or combine multiple tasks into a single edit session.
- **Local-First & Zero Friction**: Maintain extreme care for the user experience. The app is targeted at people in
  severe mental fatigue or low states—keep animations snappy (<250 ms), UI controls large and accessible, and external
  runtime dependencies at zero.
- **Completion Workflow**:
  1. Implement the requested code or architectural change for the selected task.
  2. Test and verify functionality against vanilla HTML/CSS/JS modules in `public/` and the Vitest test suite
     (`npm test`).
  3. If this task changes the schema, config, or file layout, update `docs/state.md` in the same edit — not as a
     follow-up task.
  4. If this task warrants a version bump per `docs/versioning.md`, update `package.json` in the same edit — not as
     a follow-up task. Do NOT log the bump in `docs/decisions.md`. Add to `docs/decisions.md` only if the task
     establishes a new standing constraint that passes that file's admission test (see its header).
  5. Mark the completed task as `[x]` in `docs/todo.md`.
  6. Prompt the developer/user to inspect the change before proceeding to the next item.

## Where to Look
| Question                                 | File                         | Purpose                                           |
|------------------------------------------|------------------------------|---------------------------------------------------|
| Current schema, config, stack, or files? | `docs/state.md`              | Single source of truth for live schema and state. |
| What must I not break or re-litigate?    | `docs/decisions.md`          | Standing constraints + why. Read before changes.  |
| What is the next task or what is done?   | `docs/todo.md`               | Task backlog and official roadmap.                |
| Synthetic dataset specification?         | `docs/dataset-guidelines.md` | Clinical profile & JSON guidelines.               |
| User pitch, donations, or philosophy?    | `README.md`                  | Non-technical project overview.                   |
| When should the version number change?   | `docs/versioning.md`         | SemVer policy: what counts as major/minor/patch.  |

## Suppressions: Stop and Ask
- **Never add a suppression on your own.** This covers any comment or setting that silences, skips, or relaxes a
  check, including `biome-ignore` (and `-start`/`-end` variants), JetBrains `noinspection`, `eslint-disable`,
  `@ts-ignore`/`@ts-nocheck`, `it.skip`/`it.only`/`it.todo`, edits to `biome.json` rules, and renaming a variable
  (e.g. adding a `_` prefix) solely to quiet a warning.
- **Stop and ask first.** When lint, an IDE inspection, or a test flags something you believe is a false positive or
  is too costly to fix, STOP. Do not finish the task around it. Tell the developer:
  1. The exact rule or inspection and the file/line it fires on.
  2. Why you think it is a false positive or not worth fixing.
  3. The proposed fix and the proposed suppression, so the developer can choose.
- **Only proceed once the developer approves.** An approved suppression must be as narrow as possible (a single line,
  never file-level when a line will do) and must carry a comment giving the specific reason. "False positive" alone
  is not a reason.
- **Fix the cause by default.** Prefer changing the code over silencing the check. Do not weaken tests, delete
  assertions, or loosen config to make a failure disappear.
- **Report existing suppressions you touch.** If an edit moves or depends on an existing suppression, mention it in the
  hand-off prompt instead of leaving it silently in place.

## Code & Formatting Conventions
- **Line Width Limit**:
  - All Markdown documentation files (`.md`) and code files should stay within a **120-column limit** using single
    carriage returns/line wraps for code-view readability.
- **Explicit Naming (No Truncated Abbreviations)**:
  - Do NOT use shortened abbreviations like `btn` (use `button`), `el` (use `element`), `cb` (use `callback`),
    `opts` (use `options`), `idx` (use `index`), `msg` (use `message`), `curr`/`prev` (use `current`/`previous`),
    `e`/`evt` (use `event`), `doc`/`win` (use `document`/`window`), etc.
  - Always prefer clear, fully spelled out descriptive variable and parameter names (e.g. `menuButton`,
    `targetElement`, `progressElement`, `event`, `callback`, `options`).
- **Relative Path Convention (Sub-Path & IDE Preview Compatibility)**:
  - All asset references in all files MUST use relative paths (e.g., `style.css`, `pwa-192x192.png`, `sw.js`,
    `./index.html`) rather than absolute domain-root slashes (`/style.css`, `/pwa-192x192.png`, `/sw.js`).

## Test Conventions
For all new and touched test suites:
- **Behavior-Driven Titles**: `describe` and `it` titles must describe the behavior or module under test. Never
  include roadmap task numbers (e.g. `Task 5.1`) or numeric prefixes (`1.`, `2.`).
- **Direct Imports (No `window.*` Shim)**: Import functions and constants directly from their owning module in
  `public/js/...` rather than accessing them via `window.*` or `windowInstance.*`.
- **Timer & Async Discipline**: Use `vi.useFakeTimers()` or `waitFor()`, never `sleep()`, unless the test asserts real
  elapsed time (which must be justified with an inline comment).
- **Shared Fixture Helpers**: Entry and question fixtures must come from helpers in `tests/test-utils.js` rather than
  repetitive inline object literals.
- **Pure Functions Outside App Boot**: Pure functions (e.g. layout math, gesture calculations) should be tested
  directly in isolation without invoking `setupTestDOM()`.