# Adding a problem

Problems live in `server/problems/<slug>/`. The server validates every problem at
startup and **refuses to start** if one is broken, so `npm test` catches most
mistakes before review.

## 1. Pick a track

`problem.json` `track` decides where it appears:

| Track | Page | The user writes | Graded by |
|---|---|---|---|
| `apex` | Challenge Arena | classes and/or triggers | your hidden Apex test class |
| `debug` | Debugging Arena | a fix to the **buggy starter** | your hidden Apex test class |
| `soql` | SOQL Practice | one SOQL query (`query.soql`) | comparing its rows with your reference query's rows |

## 2. Create the folder

```
server/problems/my-problem/
  problem.json
  statement.md          # Markdown shown to the user
  starter/              # what the user starts with (debug: the buggy code)
  reference/            # a correct solution, same file names as starter/
  tests/<TestClass>.cls # hidden test class
```

Copy a similar existing problem and edit it. `problem.json`:

```json
{
  "title": "Default Account Rating",
  "track": "apex",
  "difficulty": "Easy",
  "category": "Triggers",
  "order": 7,
  "tags": ["before insert"],
  "files": [{ "name": "SfcAccountRating", "type": "trigger" }],
  "testClass": "SfcAccountRatingTest"
}
```

`order` must be unique (Apex 1–99, SOQL 101+, debug 201+). SOQL problems use
`"files": [{ "name": "query", "type": "soql" }]`.

## 3. Rules the loader enforces

- Every Apex name starts with **`Sfc`** and is unique across all problems; Apex
  names are global in a learner's org.
- `starter/` and `reference/` hold exactly the files in `files`, and each file
  declares the class or trigger it promises.
- Hidden tests never use `SeeAllData=true`; they create their own records.
- Hidden tests never filter on a long text area such as `Description` (that's a
  query error, so every submission would fail). Count in Apex instead.
- **Debug:** the starter must differ from the reference.
- **SOQL:** tests use the `{{REFERENCE_QUERY}}` and `{{SOQL_COMPARE}}`
  placeholders. Never paste the reference query into the test. See
  `soql-contacts-in-city` for the pattern.

## 4. Things the loader can't check

- **Coverage:** every class and trigger must reach **75% coverage** from your hidden
  tests, or a correct solution fails to deploy.
- **Bulk:** test with 200 records wherever the statement says "bulk-safe".
- **Statement:** must name every class, method, field and alias the tests rely on.
  A learner should never fail because of something the statement didn't say.

## 5. Prove it

```bash
npm test                                              # structure
npm run verify:problems -w sfcode-server -- --user <your Clerk user id> my-problem
```

`verify:problems` needs a connected Salesforce org (see README). It grades your
`reference/` (must be **accepted**) and your `starter/` (must **not** be) through
the real grader. If you can't run it, say so in the PR and a maintainer will.
