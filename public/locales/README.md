# High & Low — Adding a Translation

Anyone can add a language with a plain text file. No programming is needed.

---

## Files

```text
public/locales/
├── manifest.json   # The list of available languages
├── en.json         # English: the template, and the fallback for any missing text
└── README.md       # This guide
```

---

## How to Add a New Language

1. Copy `en.json` to `<code>.json`, using a language code such as `fr` or `de`.
2. Translate the **values** (the text on the right). Do not change the **keys** (the text on the left).
3. Add one line to the `locales` list in `manifest.json`:
   ```json
   { "code": "fr", "name": "Français", "direction": "ltr" }
   ```
   `name` is the language written in itself (it appears in the Language menu). `direction` is `ltr` or `rtl`.
4. Done. The language shows up in Settings, is loaded when chosen, and is saved for offline use automatically.

If a translation is missing a key, the English text is shown instead, so a partial translation still works.

---

## Translation Guidelines

Per `docs/decisions.md`:

1. **Terminology**
   - The main action is a **Check-In** (for example, in Spanish: *Registro* or *Chequeo*). A saved record is an
     **Entry**.
   - Never use words meaning *Session*, *Quiz*, *Test*, or *Log* in any language. High & Low is not an evaluation,
     examination, or chore.
2. **Built-in questions** keep their fixed `id` (such as `q_energy`). Put the translated text and short label under
   `builtInQuestions.<id>`.
3. **Placeholders** such as `{current}`, `{total}`, and `{score}` must stay exactly as written. You may move them
   within the sentence.
4. **Tone** is neutral, gentle, and compassionate. Many users are mentally exhausted.