# High & Low — Drop-In Localization Guide

This directory contains drop-in localization modules and resources for High & Low. Anyone can contribute a new
translation by dropping in a single translation file without modifying core application code.

---

## File Structure

```text
public/locales/
├── index.js        # Central registry importing and exposing all active locales
├── en.js           # English locale ES module (default)
├── en.json         # English translation dictionary in JSON format
├── es.js           # Spanish locale ES module
├── es.json         # Spanish translation dictionary in JSON format
├── template.json   # Base translation template ready for translation
└── README.md       # This guide
```

---

## How to Add a New Language

### Option A: ES Module Drop-In (Recommended for Built-in Languages)

1. Copy `en.js` to `<languageCode>.js` (for example, `fr.js` for French or `de.js` for German).
2. Update the `metadata` object at the top:
   ```javascript
   export default {
       metadata: {
           code: 'fr',
           name: 'Français',
           direction: 'ltr' // or 'rtl'
       },
       // ... translated keys
   };
   ```
3. Translate the strings in your new file.
4. Open `public/locales/index.js` and register the new module:
   ```javascript
   import en from './en.js';
   import es from './es.js';
   import fr from './fr.js';

   export const LOCALES = {
       en,
       es,
       fr
   };
   ```
5. The language automatically appears in the application's Language dropdown menu.

---

### Option B: Drop-In JSON File (Runtime & Offline)

1. Copy `template.json` or `en.json` to `<languageCode>.json` (for example, `de.json`).
2. Translate all string values while keeping the keys intact.
3. Load the JSON at runtime using the built-in loader:
   ```javascript
   import { loadLocaleFromJSON } from './js/localization.js';
   await loadLocaleFromJSON('de');
   ```

---

## Important Translation Guidelines & Standing Constraints

Per the architectural guidelines in `docs/decisions.md`:

1. **Terminology Rules**:
    - **Check-In**: The primary user action is a **Check-In** (for example, in Spanish: *Registro* or *Chequeo*).
    - **Forbidden Words**: Do **NOT** use words meaning *Session*, *Quiz*, *Test*, or *Log* in any language.
      High & Low is not an evaluation, examination, or chore.
2. **Built-In Questions**:
    - Built-in questions retain their immutable `id` (such as `q_energy`, `q_mood`, `q_anxiety`).
    - Provide localized text and short labels under `builtInQuestions.<id>`.
3. **Interpolation Placeholders**:
    - Keep placeholders like `{current}`, `{total}`, and `{score}` exactly as written.
4. **Tone & Style**:
    - Neutral, gentle, and compassionate tone suitable for mental health fatigue.
