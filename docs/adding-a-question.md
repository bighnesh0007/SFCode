# Adding a certification question

Questions live in `server/certification/<exam>.json` (`pd1.json`, `pd2.json`).
The bank is validated at startup.

```json
{
  "id": "pd1-limits-soql",
  "section": "logic",
  "prompt": "How many SOQL queries can a **synchronous** Apex transaction issue before it fails?",
  "options": [
    { "id": "a", "text": "50" },
    { "id": "b", "text": "100" },
    { "id": "c", "text": "150" },
    { "id": "d", "text": "200" }
  ],
  "answer": ["b"],
  "explanation": "The synchronous limit is 100 … (say why the wrong options are wrong, too)."
}
```

## Rules

- **Write it yourself.** Never copy from exam dumps, paid question banks or
  other sites. Write from the official exam outline and Salesforce documentation.
  Copied questions will be removed.
- **Be verifiable.** Put the documentation page you checked in the PR description.
- **`id` is permanent:** `<exam>-<short-topic>`, unique across all exams. Learner
  progress is stored against it, so fix a question in place and never reuse an id.
- **Multi-answer:** list every correct id in `answer` and say "*(Choose N)*" in the
  prompt. The loader rejects a multi-answer question that doesn't.
- **`section`** must be one of the exam's `sections`.
- **Explain.** The explanation is where people learn. One or two sentences on why
  the answer is right and why the tempting wrong options are wrong.

Run `npm test` to validate the bank.
