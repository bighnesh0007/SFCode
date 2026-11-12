# Apex Challenge Arena problems

One folder per problem. Loaded and validated at server start
(`src/services/challenges/catalog.ts`) — a malformed problem stops the server.

```
<slug>/
  problem.json     metadata (validated by zod: see catalog.ts)
  statement.md     shown to the user
  starter/         files the user edits — names are fixed by problem.json
  reference/       a passing solution (same file names as starter/)
  tests/<Test>.cls hidden test class, deployed alongside the user's files
```

Rules:
- `starter/` and `reference/` hold exactly the files listed in `problem.json` `files`.
- Hidden tests must not depend on org data (no `SeeAllData=true`) and must cover
  the reference solution well above 75%: a check-only deploy with
  `RunSpecifiedTests` fails any class or trigger under 75% coverage.
- Prefix every class/trigger name with `Sfc` so it cannot collide with
  something already in the learner's org.
- A reference solution is only proven by running it: `npm run verify:problems`
  with a connected org grades every `reference/` through the real grader.
  Never mark a problem verified by reading it.
