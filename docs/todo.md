# High & Low — Development TODO & Agent Operating Protocol

## Agent Execution Methodology & Guidelines

You are an autonomous software developer working on "High & Low", a local-first, low-friction mood tracking web application built strictly with vanilla HTML, CSS, and JavaScript (no frameworks, compilers, or external dependencies).

### Core Directives for the Agent:
1. **Single Task Focus:** Execute **ONE single unchecked task (`[ ]`) at a time**. Do NOT move to the next task or combine multiple tasks into a single edit session.
2. **Local-First & Zero Friction:** Maintain extreme care for the user experience. The app is targeted at people in severe mental fatigue or low states—keep animations snappy (<250ms), UI controls large and accessible, and external dependencies at zero.
3. **Completion Workflow:**
    - Implement the requested code or architectural change for the selected task.
    - Test/verify the functionality within the bounds of the vanilla HTML/CSS/JS files (`index.html`, `style.css`, `app.js`).
    - Mark the completed task as `[x]` in this `todo.md` file.
    - Prompt the developer/user to inspect the change before proceeding to the next item.

---

## Task Backlog

### Phase 1: Storage Layer & Data Safety (IndexedDB Engine)
- [ ] **Task 1.1: IndexedDB Fallback & Error Handling**
    - Implement robust browser support checks for `window.indexedDB` inside `app.js`.
    - Add error handling fallbacks so that if IndexedDB is blocked or private browsing prevents access, the user is gracefully alerted rather than experiencing a broken app state.

- [ ] **Task 1.2: Advanced Data Merge & De-duplication Logic**
    - Refine `handleFileImport` in `app.js` to handle both `replace` and `merge` modes cleanly.
    - Implement millisecond-level exact matching on incoming log timestamps during merge operations to skip identical duplicates while appending unique historical logs without key collisions.

- [ ] **Task 1.3: "Testing only" banner**
    - Implement a bright yellow banner with bold black text that informs any user that the version they are looking at is for testing only, and should not be used for psychiatric purposes.
    - Ensure that the banner is easily hidden from the user via changing a single line of CSS.
    - Place the CSS 'testing switch' at the top of `style.css` and signpost it for easy finding by a web-master or developer.

---

### Phase 2: User Interface & Accessibility Refinements
- [ ] **Task 2.1: Dynamic System Theme Listener**
    - Extend the theme switcher in `app.js` and `style.css` to listen for system-level dark/light mode preference changes (`window.matchMedia('(prefers-color-scheme: dark)')`).
    - Ensure theme transitions seamlessly when `data-theme="system"` is set without losing border visibility or color contrast.

- [ ] **Task 2.2: Keyboard & Screen Reader Accessibility Pass**
    - Audit `index.html` to ensure all 1–5 scale buttons, hold actions, and utility triggers have proper `aria-label`, `role="button"`, and tabindex attributes.
    - Add full keyboard navigation support (Arrow keys for score selection, Enter/Space for hold buttons and drawer triggers).

- [ ] **Task 2.3: Pastel Palette Refinement for Light Mode**
    - Review color curves in `style.css` under `body[data-theme="light"]`.
    - Ensure "Less is Better", "More is Better", and "Middle is Best" question curves render soft, high-visibility pastel tones instead of dark, low-contrast hex values on light backgrounds.

---

### Phase 3: Offline Capabilities & PWA Readiness
- [ ] **Task 3.1: Service Worker Implementation**
    - Create a lightweight vanilla service worker (`sw.js`) to cache static assets (`index.html`, `style.css`, `app.js`, `manifest.json`).
    - Register the service worker inside `app.js` to enable 100% offline functionality.

- [ ] **Task 3.2: Web App Manifest Verification**
    - Verify and complete `manifest.json` with correct relative paths, high-resolution app icons, theme colors (`#121212`), and `display: "standalone"` parameters.

---

### Phase 4: Documentation & Final Cleanup
- [ ] **Task 4.1: Code Base JSDoc & Architectural Comments**
    - Perform a complete documentation pass on `app.js`, adding JSDoc comments to all core functions (`initDatabase`, `renderCurrentQuestion`, `exportAllDataAndConfig`, `handleFileImport`).

- [ ] **Task 4.2: Workspace File Cleanup**
    - Remove any unneeded project boilerplate files (such as `package.json` or `index.js` if created by IDE defaults) and verify the repository remains strictly clean vanilla files.
