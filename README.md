# CRA Compliance assessment tool for identity, access control

Modular survey webapp that assesses a product's identity and access management choices against the EU Cyber Resilience Act (CRA) and maps answers to CRA Annex I requirements and reference frameworks. Declarative JSON (id, type, text, options, role, showIf, next/end) + JSON-Logic for visibility + minimal engine and renderer.

## Structure

- **`data/questions.json`** – Question tree: `id`, `type` (single | multi | message), `text`, `options` (value, label, optional `next`, `end`, `finalMessage`), optional `showIf` (JSON-Logic).
- **`data/questions.schema.json`** – Optional JSON Schema for validating the questions file.
- **`js/survey-engine.js`** – State (`answers`), `getVisibleQuestions()` (showIf + “all applicable answered” for message), `applyAnswer()` / `setMultiAnswer()`, `next` / `end` handling.
- **`js/survey-renderer.js`** – Renders visible questions (radio/checkbox/message), wires inputs, shows `finalMessage` on `end`, scrolls to `next` when given.
- **`js/app.js`** – Loads `questions.json`, wraps JSON-Logic, creates engine, mounts renderer, updates answer summary.

## Run locally

`fetch()` needs a real origin; open `index.html` via a local server, e.g.:

```bash
npx serve .
# or: python3 -m http.server 8080
```

Then open the URL shown (e.g. http://localhost:3000).

## Key behaviour

- **showIf**: Evaluated with `{ answers }`; only questions whose `showIf` is missing or true are visible.
- **message**: The final `type: "message"` question is shown when all applicable (non-message, showIf-passing) questions are answered.
- **end**: If an option has `end: true`, its `finalMessage` is shown and no further questions are rendered.
- **next**: If an option has `next: "Qid"`, the UI re-renders and scrolls to that question.

No framework lock-in; you can swap the renderer or engine for another stack.
