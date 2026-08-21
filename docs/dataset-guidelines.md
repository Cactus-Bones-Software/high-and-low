# Synthetic Dataset Generation Guidelines

These guidelines are designed for an LLM to generate a realistic test dataset JSON file for **High & Low**.

---

## 1. Persona & Clinical Profile
* **Patient Identity**: Male patient, ~32 years old, diagnosed with **Bipolar II Disorder**.
* **Clinical Course (4 Months / ~120 Days)**:
    * **Month 1 (Days 1–30)**: Baseline mild euthymia / dysthymia transitioning into moderate-to-deep major depression (anhedonia, sluggish energy, low self-worth, social withdrawal).
    * **Month 2 (Days 31–60)**: Protracted depressive episode bottoming out around Day 40–48, followed by sluggish gradual recovery.
    * **Month 3 (Days 61–90)**: Shift into hypomanic prodrome and acute hypomanic episode (4–8 days of high energy, racing thoughts, irritable agitation, decreased need for sleep, heightened impulsivity/spending), followed by a brief mixed/crash phase.
    * **Month 4 (Days 91–120)**: Post-hypomanic stabilization on mood stabilizer adjustment; mild residual fatigue, returning to baseline euthymia with occasional evening dips.

---

## 2. Check-In & Note Frequency
* **Total Duration**: Approximately 120 consecutive calendar days (e.g., from `2026-05-01T...` to `2026-08-30T...`).
* **Check-In Cadence**:
    * 1 to 2 entries per day (typically morning ~08:30 and evening ~21:00, with occasional single-check-in days when depressed/exhausted or missed check-ins). Total entries: **~140–180 entries**.
* **Free-Text Notes**:
    * **Average 1 note per week** (~15–20 notes total across the 4-month span).
    * Notes should feel authentic, concise, and reflective of the patient's state (e.g. sleep changes, medication side effects, hypomanic project ideas, depressive exhaustion, social triggers).

---

## 3. High & Low JSON Backup Schema

The output must be a single valid JSON object formatted for the **High & Low** backup import (`exportVersion: "2.0"`):

```json
{
  "exportVersion": "2.0",
  "exportTimestamp": "2026-08-30T21:00:00.000Z",
  "config": [
    { "key": "activeQuestionSet", "value": ["q_energy", "q_sadness", "q_irritability", "q_overall"] },
    { "key": "theme", "value": "system" },
    { "key": "contrast", "value": "low" },
    { "key": "menuSide", "value": "right" },
    { "key": "holdDelay", "value": "enabled" },
    { "key": "seedVersion", "value": 3 }
  ],
  "questions": [
    {
      "id": "q_energy",
      "text": "What is your current energy level?",
      "shortLabel": "Energy Level",
      "curve": "more-is-better",
      "minLabel": "Bedbound/Depleted",
      "maxLabel": "Fully Charged",
      "midLabel": null,
      "builtIn": true,
      "archived": false,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    },
    {
      "id": "q_sadness",
      "text": "How heavy or deep is your sadness right now?",
      "shortLabel": "Sadness Depth",
      "curve": "less-is-better",
      "minLabel": "No Sadness",
      "maxLabel": "Overwhelming",
      "midLabel": null,
      "builtIn": true,
      "archived": false,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    },
    {
      "id": "q_worth",
      "text": "How is your sense of self-worth and guilt?",
      "shortLabel": "Self-Worth",
      "curve": "more-is-better",
      "minLabel": "Intense Guilt/Worthless",
      "maxLabel": "At Peace",
      "midLabel": null,
      "builtIn": true,
      "archived": false,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    },
    {
      "id": "q_irritability",
      "text": "How irritable or easily agitated do you feel?",
      "shortLabel": "Irritability",
      "curve": "less-is-better",
      "minLabel": "Calm & Patient",
      "maxLabel": "Highly Snappy",
      "midLabel": null,
      "builtIn": true,
      "archived": false,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    },
    {
      "id": "q_racing",
      "text": "How fast are your thoughts moving?",
      "shortLabel": "Racing Thoughts",
      "curve": "less-is-better",
      "minLabel": "Quiet & Focused",
      "maxLabel": "Unstoppable Racing",
      "midLabel": null,
      "builtIn": true,
      "archived": false,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    },
    {
      "id": "q_impulse",
      "text": "Are you experiencing restless or reckless urges?",
      "shortLabel": "Restless Urges",
      "curve": "less-is-better",
      "minLabel": "Deliberate",
      "maxLabel": "Highly Impulsive",
      "midLabel": null,
      "builtIn": true,
      "archived": false,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    },
    {
      "id": "q_overall",
      "text": "Overall, where does your mood sit right now?",
      "shortLabel": "Overall Mood",
      "curve": "middle-is-best",
      "minLabel": "Deeply Low",
      "maxLabel": "Manic/Spiked",
      "midLabel": "Stable & Even",
      "builtIn": true,
      "archived": false,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    }
  ],
  "entries": [
    {
      "timestamp": "2026-05-01T08:30:00.000Z",
      "dateString": "2026-05-01",
      "note": "Slept okay, feeling relatively stable today.",
      "answers": [
        { "questionId": "q_energy", "score": 3, "status": "answered" },
        { "questionId": "q_sadness", "score": 1, "status": "answered" },
        { "questionId": "q_irritability", "score": 2, "status": "answered" },
        { "questionId": "q_overall", "score": 3, "status": "answered" }
      ]
    }
  ]
}
```

---

## 4. Scoring Logic & Symptom Dynamics

1. **Integer Scale (1–5)**:
    * Each answer must have `score: 1 | 2 | 3 | 4 | 5` and `status: "answered"`, OR `score: null` and `status: "skipped"`.
2. **Curve Correlations**:
    * **Depressive Phase**: `q_energy` = 1–2, `q_sadness` = 4–5, `q_worth` = 1–2, `q_overall` = 1–2.
    * **Hypomanic Phase**: `q_energy` = 4–5, `q_racing` = 4–5, `q_irritability` = 3–5, `q_impulse` = 4–5, `q_overall` = 4–5.
    * **Euthymic (Stable) Phase**: `q_energy` = 3, `q_sadness` = 1–2, `q_irritability` = 1–2, `q_racing` = 1–2, `q_overall` = 3 (where 3 = "Stable & Even").
3. **Realistic Variances**:
    * Include occasional skipped questions (`status: "skipped", score: null`).
    * Keep timestamps in ascending chronological order with realistic times (`08:15`, `13:40`, `21:10`).
