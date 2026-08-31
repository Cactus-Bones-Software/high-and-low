# Agent Instructions & Project Conventions

## Core Philosophy & Directives
- **Project Identity**: You are working on "High & Low", a local-first, low-friction mood tracking web application
  built strictly with vanilla HTML, CSS, and JavaScript (no frameworks, compilers, or external runtime dependencies).
- **Single Task Focus**: Execute **ONE single unchecked task (`[ ]`) at a time** from `docs/todo.md`. Do NOT move to
  the next task or combine multiple tasks into a single edit session.
- **Local-First & Zero Friction**: Maintain extreme care for the user experience. The app is targeted at people in
  severe mental fatigue or low states—keep animations snappy (<250ms), UI controls large and accessible, and external
  runtime dependencies at zero.
- **Completion Workflow**:
  1. Implement the requested code or architectural change for the selected task.
  2. Test and verify functionality against vanilla HTML/CSS/JS modules in `public/` and the Vitest test suite
     (`npm test`).
  3. If this task changes the schema, config, or file layout, update `docs/state.md` in the same edit — not as a
     follow-up task.
  4. Mark the completed task as `[x]` in `docs/todo.md`.
  5. Prompt the developer/user to inspect the change before proceeding to the next item.

## Where to Look
| Question                                 | File                         | Purpose                                           |
|------------------------------------------|------------------------------|---------------------------------------------------|
| Current schema, config, stack, or files? | `docs/state.md`              | Single source of truth for live schema and state. |
| Why was a feature designed this way?     | `docs/decisions.md`          | Chronological rationale & design decisions.       |
| What is the next task or what is done?   | `docs/todo.md`               | Task backlog and official roadmap.                |
| Synthetic dataset specification?         | `docs/dataset-guidelines.md` | Clinical profile & JSON guidelines.               |
| User pitch, donations, or philosophy?    | `README.md`                  | Non-technical project overview.                   |

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
