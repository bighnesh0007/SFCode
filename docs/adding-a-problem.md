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
| `flow` | Flows | nothing on SFCode: they **build the flow in their own org** | your hidden Apex test class, which fires the flow |
| `lwc` | LWC | a component's `.html`, `.js`, `.css` | **Run tests**: your visible tests in the browser. **Submit**: your hidden tests, in a server sandbox container |

Flow and LWC problems have their own folder layouts; see the sections at the end.

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

`order` must be unique (Apex 1–99, SOQL 101+, debug 201+, flow 301+, LWC 401+).
SOQL problems use `"files": [{ "name": "query", "type": "soql" }]`.

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

## 5. Hints and an editorial (recommended)

```
server/problems/my-problem/
  hints.json     # ["a nudge", "a bigger nudge", "nearly the answer"]: 1 to 3, cheapest first
  editorial.md   # the approach, the pitfalls, and why it works
```

Learners buy hints with coins (2, 4, 6) and see everything once they solve the
problem. Write hints as a ladder: the first points at the idea, the last is one
step from the answer. The editorial explains the *why*. You can include the
solution, since only learners who have solved the problem see it.

## 6. Prove it

```bash
npm test                                              # structure
npm run verify:problems -w sfcode-server -- --user <your Clerk user id> my-problem
```

`verify:problems` needs a connected Salesforce org (see README). It grades your
`reference/` (must be **accepted**) and your `starter/` (must **not** be) through
the real grader. If you can't run it, say so in the PR and a maintainer will.

## Flow problems

The learner builds the flow in **their own org's Flow Builder**; SFCode only
deploys your hidden test class (check-only), which fires their active flow.

```
server/problems/flow-my-problem/
  problem.json      # "track": "flow", "files": [], "flow": { "apiName": "SFC_…", "kind": "record-triggered" | "autolaunched" }
  statement.md      # a table of exact settings: API name, object, trigger, optimize-for; variable names for autolaunched
  reference/SFC_….flow-meta.xml   # a working, ACTIVE flow; only verify:problems deploys it
  tests/<TestClass>.cls
```

- The flow API name starts with **`SFC_`**. The statement must give it exactly; the
  tests find the flow by name.
- Record-triggered: tests do DML and assert the result. Autolaunched: tests call
  `Flow.Interview.createInterview('SFC_…', inputs)`, `.start()`, then read
  `getVariableValue('…')`. See `flow-shipping-cost`.
- The easiest way to get the reference XML is to build the flow in a Developer
  Edition org and retrieve it (`sf project retrieve start -m Flow:SFC_…`).
- `verify:problems` deploys the reference plus the tests (must be accepted) and the
  tests alone (must fail; that proves they depend on the flow).

## LWC problems

The component is compiled by SFCode's server and runs, with its tests, in a
sandboxed iframe **in the learner's browser**. No org is involved.

```
server/problems/lwc-my-problem/
  problem.json      # "track": "lwc", "files": [], "lwc": { "component": "myThing" }   (no testClass)
  statement.md
  starter/myThing.html  myThing.js  myThing.css   (all three, CSS may be empty)
  reference/myThing.html myThing.js myThing.css
  tests/myThing.test.js          visible: "Run tests" in the browser (learners can read these)
  tests/myThing.hidden.test.js   graded: "Submit" runs these on the server; include the visible tests plus more
```

The test file defines `const tests = [...]`. Each test is
`{ name, async run({ mount, q, qa, flush, assert, equal }) }`:

| Helper | Does |
|---|---|
| `mount(props)` | creates a fresh component with those `@api` props and attaches it |
| `q(el, sel)` / `qa(el, sel)` | `querySelector` / `querySelectorAll` (as an array) inside its shadow root |
| `flush()` | waits for the component to re-render after a change |
| `assert(cond, msg)`, `equal(actual, expected, msg)` | fail the test with a readable message |

- Write failure messages for the learner: *"Expected one li.contact per contact"*
  beats a bare `expected 5, got 0`.
- Salesforce's `lightning-*` base components aren't available; use plain HTML.
- `myThing.test.js` is visible to learners (it runs in their browser). Scoring uses
  `myThing.hidden.test.js`, which never leaves the server: keep every visible test in
  it and add cases that only the statement's rules decide.
- Prove it in a browser: open the problem, put the reference in the editor, and
  check **Run tests** passes; with the starter it must fail. (`verify:problems`
  only checks that both compile.)
- Or prove it in the grading container, which is what **Submit** uses: with Docker,
  `SFC_TEST_LWC_IMAGE=<the sfcode-lwc-runner image> npx vitest run tests/lwcSandbox.docker.test.ts`
  grades every LWC problem's reference (must pass every hidden test) and starter
  (must fail one). Then break your reference on purpose and check a test catches it.
- A whole test file must finish in **8 seconds**. For timers, add an `@api` property
  for the interval (default the real value) and use a short one in most tests; see
  `lwc-countdown`.
