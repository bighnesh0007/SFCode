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
- **Don't let length or position give it away.** Write the wrong options as fully and
  specifically as the right one: if the right answer is usually the longest, people
  pass by guessing. Vary which letter is correct. `npm test` fails a bank where one
  letter holds more than 40% of the answers or the right answer is the longest
  option in more than 40% of questions. Keep the explanation's opening words out of
  the prompt and options too: a test checks that answers can't leak.

Run `npm test` to validate the bank.
