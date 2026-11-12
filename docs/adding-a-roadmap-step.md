# Adding a roadmap step

Roadmaps live in `server/roadmaps/<id>.json` (`developer.json`, `admin.json`).
The server validates them at startup and **refuses to start** if one is broken,
so `npm test` catches most mistakes.

## A step

```json
{
  "id": "admin-reports",
  "title": "Reports & dashboards",
  "level": 4,
  "col": 0,
  "requires": ["admin-ui"],
  "summary": "Report types, formats and dashboard running users.",
  "lesson": "Markdown, a few short paragraphs…",
  "problems": [],
  "cert": { "exam": "pd1", "section": "testing" },
  "quiz": [
    { "q": "Question?", "options": ["A", "B", "C", "D"], "answer": 2, "why": "One line on why C is right." }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | Unique **across all roadmaps** (read marks aren't namespaced). Prefix admin steps `admin-`. |
| `requires` | Steps that must be done (or already known) first. No cycles. |
| `level` | 1–4. The welcome quiz marks steps at or below a learner's level as "already known". |
| `col` | 0–2: the column in the graph. Rows come from `requires`, so give siblings different columns. |
| `problems` | Existing problem slugs. The step completes when the org-graded ones are solved. |
| `lesson` | Short Markdown. Teach the one idea the problems or quiz need. |
| `cert` | Optional link to a Certification Prep exam/section. |
| `quiz` | Optional, 3+ questions, 2–5 options each, `answer` is the index of the right option. |

## How a step completes

- **Has org-graded problems:** solving all of them.
- **Has a quiz (and no graded problems):** passing it, at most one wrong. Answers
  stay on the server until the learner submits.
- **Only a lesson, or only LWC problems:** the learner marks it done.

## Rules the loader enforces

- Every linked problem exists; every `requires` names a real step; no cycles.
- Ids are unique across files; quiz `answer` indexes are in range.
- A step has something to do: problems, a lesson, a cert link or a quiz.

## Writing good quiz questions

- Scenario first: "A few users need to edit one extra field. Best approach?"
  beats "What is a permission set?".
- One clearly right answer; wrong options should be plausible mistakes.
- `why` explains the right answer in one line; it's shown after submitting.
- Keep facts current with Salesforce's own docs, and say so in your PR.

Run `npm test`, then open `/roadmap` locally to see the graph.
