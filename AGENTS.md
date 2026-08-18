# Agent Instructions & Project Conventions

## Core Philosophy & Directives
- **Project Identity**: You are working on "High & Low", a local-first, low-friction mood tracking web application built strictly with vanilla HTML, CSS, and JavaScript (no frameworks, compilers, or external runtime dependencies).
- **Single Task Focus**: Execute **ONE single unchecked task (`[ ]`) at a time**. Do NOT move to the next task or combine multiple tasks into a single edit session.
- **Local-First & Zero Friction**: Maintain extreme care for the user experience. The app is targeted at people in severe mental fatigue or low states—keep animations snappy (<250ms), UI controls large and accessible, and external runtime dependencies at zero.
- **Completion Workflow**:
    1. Implement the requested code or architectural change for the selected task.
    2. Test/verify the functionality within the bounds of the vanilla HTML/CSS/JS files (`index.html`, `style.css`, `app.js`) and Vitest test suite (`npm test` / `npx vitest run`).
    3. Mark the completed task as `[x]` in `docs/todo.md`.
    4. Prompt the developer/user to inspect the change before proceeding to the next item.

## Key Documentation & Reference Files
When you need clarity on project specifications, architecture, locked decisions, or upcoming tasks, consult the following key documentation files:

- **`public/`**: Directory for deployable app files, for organizational and scriptability reasons. All web app files will be found here.
- **`docs/project-context.md`**: Project overview, core tech stack constraints (vanilla HTML/CSS/JS, IndexedDB, Service Worker), architectural rules, state and data schemas (`Active State`, `Question Object`, `Log Entry`), and explicit non-goals. Consult this for high-level rules, schema structure, or foundational stack constraints.
- **`docs/design-decisions.md`**: Chronological record of locked product and architectural decisions (navigation patterns, questions store & FNV-1a custom ID hashing, scoring curve semantics, multi-log continuous timeline scaling, sessionStorage session persistence, explicit naming standards) and open design questions. Consult this whenever verifying why a feature is designed a specific way or resolving architectural ambiguities.
- **`docs/todo.md`**: The official development backlog and roadmap. Contains active and completed tasks organized by phases. Consult this to find the next active task (`[ ]`) or track implementation status.
- **`README.md`**: High-level user-facing documentation, product motivation, UI interaction paradigms (e.g. hold-barrier ergonomics), and technical architecture overview. Consult this for product purpose and end-user feature overviews.

## Code Naming Conventions
- **Explicit Naming (No Truncated Abbreviations)**:
    - Do NOT use shortened abbreviations like `btn` (use `button`), `el` (use `element`), `cb` (use `callback`), `opts` (use `options`), `idx` (use `index`), `msg` (use `message`), `curr`/`prev` (use `current`/`previous`), `e`/`evt` (use `event`), `doc`/`win` (use `document`/`window`), etc.
    - Always prefer clear, fully spelled out descriptive variable and parameter names (e.g. `menuButton`, `targetElement`, `progressElement`, `event`, `callback`, `options`).
