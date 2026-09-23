### **System Context & Single Source of Truth**

* **Canonical Version Source:** `package.json` (`version` field).
* **Live System & Schema State:** `docs/state.md`
* **Version Decision History:** `docs/decisions.md` (logs rationale for bumps).
* **Release Artifacts:** Git tags (`vX.Y.Z`).

---

### **Pre-1.0 Rules & Constraints**

* Current status is **0.y.z** (initial development stage).
* Public schema/format is **unstable**; breaking changes are allowed under **MINOR** (0.X.0) bumps.
* **Prerequisites for 1.0.0 Release:**
1. Testing banner (`docs/todo.md`, Task 1.3) is removed for production release.
2. `HighAndLowDB` IndexedDB schema and JSON backup/restore formats are stabilized with backward-compatibility guarantees.

---

### **Version Bump Decision Matrix**

| Level               | Condition                                                                  | Actions / Impact                                                                                                                                                  | Examples                                                                          |
|---------------------|----------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| **MAJOR** (`X.0.0`) | Breaking schema, config, or data export changes requiring data migration.  | Non-additive `HighAndLowDB` schema changes; non-backwards-compatible backup JSON export/import structural changes; breaking changes to stored config key formats. | Renaming/removing IndexedDB object stores, key paths, or mandatory record fields. |
| **MINOR** (`0.X.0`) | New capabilities; strictly backwards-compatible with existing client data. | Additive schema/record fields; additive config keys; new views, settings, or question types.                                                                      | Adding a new setting or optional question field.                                  |
| **PATCH** (`0.0.X`) | Backwards-compatible bug fixes and internal refactors.                     | Visual polish & UI fixes; accessibility updates; code formatting / linting fixes; pure logic bug fixes (no schema impact).                                        | Correcting a calculation error or fixing CSS.                                     |

---

### **Agent Execution Workflow**

When submitting changes that alter versions, perform the following in a single transaction:

1. **Calculate Bump:** Apply matrix rules above.
2. **`package.json`:** Update `"version": "X.Y.Z"`.
3. **`docs/state.md`:** Update active schema/config documentation if altered.
4. **`docs/decisions.md`:** Record any major changes or changes that can break backwards compatibility, along with rationale. 
5. **Git Operations:** Execute `git tag vX.Y.Z` and `git push --tags`.

---